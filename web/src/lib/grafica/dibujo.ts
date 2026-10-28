/**
 * Dibujo de una gráfica 2D en un canvas: rejilla, franjas, series, referencias, ejes y textos.
 * Trabaja en píxeles CSS; el llamador fija la escala por devicePixelRatio.
 */
import { formatoDecimal, formatoPotencia10 } from "@/lib/formato";
import { COLOR_REJILLA, COLOR_TENUE, COLOR_TINTA } from "@/lib/modulacionesUi";
import { crearEscala, decimalesDePaso, decimarMinMax, marcasLineales, marcasLog, type Escala } from "./escalas";
import type { DatosGrafica, EjeGrafica, MarcadorGrafica, SerieGrafica, TrazoGrafica } from "./tipos";

const TAMANO_MARCAS = 12;
const TAMANO_TITULO_EJE = 13;
const COLOR_FONDO = "#ffffff";

interface Marca {
  valor: number;
  texto: string;
}

interface MarcasEje {
  principales: Marca[];
  menores: number[];
}

function marcasDeEje(eje: EjeGrafica, longitudPx: number): MarcasEje {
  const [d0, d1] = eje.dominio;
  if (eje.escala === "log") {
    const { decadas, menores } = marcasLog(d0, d1);
    return {
      principales: decadas.map((e) => ({ valor: 10 ** e, texto: eje.formato ? eje.formato(10 ** e) : formatoPotencia10(e) })),
      menores,
    };
  }
  const objetivo = eje.marcas ?? Math.max(3, Math.min(10, Math.round(longitudPx / 80)));
  const { valores, paso } = marcasLineales(d0, d1, objetivo);
  const decimales = decimalesDePaso(paso);
  return {
    principales: valores.map((v) => ({ valor: v, texto: eje.formato ? eje.formato(v) : formatoDecimal(v, decimales) })),
    menores: [],
  };
}

function patronTrazo(trazo: TrazoGrafica | undefined): number[] {
  if (trazo === "discontinuo") return [6, 4];
  if (trazo === "punteado") return [2, 3];
  return [];
}

function trazarLinea(ctx: CanvasRenderingContext2D, serie: Extract<SerieGrafica, { tipo: "linea" }>, ex: Escala, ey: Escala) {
  const columnas = Math.max(1, Math.round(Math.abs(ex.rango[1] - ex.rango[0])));
  const indices = decimarMinMax(serie.x, serie.y, ex.dominio[0], ex.dominio[1], columnas);
  ctx.save();
  ctx.strokeStyle = serie.color;
  ctx.globalAlpha = serie.opacidad ?? 1;
  ctx.lineWidth = serie.grosor ?? 1.5;
  ctx.lineJoin = "round";
  ctx.setLineDash(patronTrazo(serie.trazo));
  ctx.beginPath();
  let abierto = false;
  for (const i of indices) {
    const px = ex.aPixel(serie.x[i]);
    const py = ey.aPixel(serie.y[i]);
    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      abierto = false;
      continue;
    }
    if (abierto) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
    abierto = true;
  }
  ctx.stroke();
  ctx.restore();
}

function trazarMarcador(ctx: CanvasRenderingContext2D, marcador: MarcadorGrafica, x: number, y: number, r: number) {
  switch (marcador) {
    case "cuadrado":
      ctx.rect(x - r, y - r, 2 * r, 2 * r);
      break;
    case "triangulo":
      ctx.moveTo(x, y - r * 1.2);
      ctx.lineTo(x + r * 1.1, y + r * 0.8);
      ctx.lineTo(x - r * 1.1, y + r * 0.8);
      ctx.closePath();
      break;
    case "cruz":
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r);
      ctx.lineTo(x - r, y + r);
      break;
    default:
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, 2 * Math.PI);
  }
}

function trazarPuntos(ctx: CanvasRenderingContext2D, serie: Extract<SerieGrafica, { tipo: "puntos" }>, ex: Escala, ey: Escala) {
  const marcador = serie.marcador ?? "circulo";
  const r = serie.radio ?? 2;
  const n = Math.min(serie.x.length, serie.y.length);
  ctx.save();
  ctx.globalAlpha = serie.opacidad ?? 1;
  if (ctx.globalAlpha < 1 && marcador !== "cruz") {
    // Translúcidos: un relleno por punto para que la densidad de la nube se acumule.
    ctx.fillStyle = serie.color;
    for (let i = 0; i < n; i++) {
      const px = ex.aPixel(serie.x[i]);
      const py = ey.aPixel(serie.y[i]);
      if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
      ctx.beginPath();
      trazarMarcador(ctx, marcador, px, py, r);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  // Opacos: un solo camino por serie, una llamada de relleno.
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const px = ex.aPixel(serie.x[i]);
    const py = ey.aPixel(serie.y[i]);
    if (Number.isFinite(px) && Number.isFinite(py)) trazarMarcador(ctx, marcador, px, py, r);
  }
  if (marcador === "cruz") {
    ctx.strokeStyle = serie.color;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = serie.color;
    ctx.fill();
    if (r >= 3) {
      ctx.strokeStyle = COLOR_FONDO;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Dibuja la gráfica completa en un canvas de `ancho × alto` píxeles CSS. */
export function dibujarGrafica(
  ctx: CanvasRenderingContext2D,
  ancho: number,
  alto: number,
  fuente: string,
  datos: DatosGrafica,
): void {
  const { ejeX, ejeY, series, bandas = [], referencias = [], anotaciones = [] } = datos;
  ctx.clearRect(0, 0, ancho, alto);
  ctx.fillStyle = COLOR_FONDO;
  ctx.fillRect(0, 0, ancho, alto);

  const fuenteMarcas = `${TAMANO_MARCAS}px ${fuente}`;
  const fuenteTitulo = `500 ${TAMANO_TITULO_EJE}px ${fuente}`;
  const altoAprox = alto - 70;
  const marcasY = marcasDeEje(ejeY, altoAprox);
  ctx.font = fuenteMarcas;
  const anchoMarcasY = Math.max(0, ...marcasY.principales.map((m) => ctx.measureText(m.texto).width));

  const margenIzq = 10 + TAMANO_TITULO_EJE + 10 + anchoMarcasY + 8;
  const margenDer = 14;
  const margenSup = anotaciones.some((a) => a.y === undefined) ? 26 : 12;
  const margenInf = 8 + TAMANO_MARCAS + 10 + TAMANO_TITULO_EJE + 10;
  const x0 = margenIzq;
  const x1 = Math.max(x0 + 10, ancho - margenDer);
  const y0 = margenSup;
  const y1 = Math.max(y0 + 10, alto - margenInf);

  const ex = crearEscala(ejeX.escala ?? "lineal", ejeX.dominio, [x0, x1]);
  const ey = crearEscala(ejeY.escala ?? "lineal", ejeY.dominio, [y1, y0]);
  const marcasX = marcasDeEje(ejeX, x1 - x0);

  // Rejilla
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLOR_REJILLA;
  ctx.beginPath();
  for (const m of marcasX.principales) {
    const px = Math.round(ex.aPixel(m.valor)) + 0.5;
    ctx.moveTo(px, y0);
    ctx.lineTo(px, y1);
  }
  for (const m of marcasY.principales) {
    const py = Math.round(ey.aPixel(m.valor)) + 0.5;
    ctx.moveTo(x0, py);
    ctx.lineTo(x1, py);
  }
  ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  for (const v of marcasY.menores) {
    const py = Math.round(ey.aPixel(v)) + 0.5;
    ctx.moveTo(x0, py);
    ctx.lineTo(x1, py);
  }
  for (const v of marcasX.menores) {
    const px = Math.round(ex.aPixel(v)) + 0.5;
    ctx.moveTo(px, y0);
    ctx.lineTo(px, y1);
  }
  ctx.stroke();
  ctx.restore();

  // Área de datos recortada
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
  for (const b of bandas) {
    ctx.fillStyle = b.color;
    if (b.eje === "x") {
      const a = ex.aPixel(b.desde);
      const c = ex.aPixel(b.hasta);
      ctx.fillRect(Math.min(a, c), y0, Math.abs(c - a), y1 - y0);
    } else {
      const a = ey.aPixel(b.desde);
      const c = ey.aPixel(b.hasta);
      ctx.fillRect(x0, Math.min(a, c), x1 - x0, Math.abs(c - a));
    }
  }
  for (const s of series) {
    if (s.tipo === "linea") trazarLinea(ctx, s, ex, ey);
    else trazarPuntos(ctx, s, ex, ey);
  }
  for (const r of referencias) {
    ctx.save();
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 1.25;
    ctx.setLineDash(patronTrazo(r.trazo ?? "discontinuo"));
    ctx.beginPath();
    if (r.eje === "y") {
      const py = ey.aPixel(r.valor);
      ctx.moveTo(x0, py);
      ctx.lineTo(x1, py);
    } else {
      const px = ex.aPixel(r.valor);
      ctx.moveTo(px, y0);
      ctx.lineTo(px, y1);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // Textos de bandas y referencias, dentro del área
  ctx.save();
  ctx.font = fuenteMarcas;
  for (const b of bandas) {
    if (!b.etiqueta || b.eje !== "x") continue;
    const centro = (ex.aPixel(b.desde) + ex.aPixel(b.hasta)) / 2;
    ctx.fillStyle = COLOR_TINTA;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(b.etiqueta, Math.min(Math.max(centro, x0 + 60), x1 - 60), y1 - 6);
  }
  for (const r of referencias) {
    if (!r.etiqueta) continue;
    ctx.fillStyle = r.color;
    if (r.eje === "y") {
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(r.etiqueta, x1 - 6, ey.aPixel(r.valor) - 3);
    } else {
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(r.etiqueta, ex.aPixel(r.valor) + 4, y0 + 4);
    }
  }
  for (const a of anotaciones) {
    ctx.fillStyle = a.color ?? COLOR_TINTA;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const py = a.y === undefined ? y0 - 6 : ey.aPixel(a.y) - 4;
    const px = ex.aPixel(a.x);
    if (px >= x0 - 1 && px <= x1 + 1) ctx.fillText(a.texto, px, py);
  }
  ctx.restore();

  // Marco y marcas
  ctx.save();
  ctx.strokeStyle = COLOR_TENUE;
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x0) + 0.5, Math.round(y0) + 0.5, Math.round(x1 - x0), Math.round(y1 - y0));
  ctx.font = fuenteMarcas;
  ctx.fillStyle = COLOR_TENUE;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const m of marcasX.principales) ctx.fillText(m.texto, ex.aPixel(m.valor), y1 + 6);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const m of marcasY.principales) ctx.fillText(m.texto, x0 - 6, ey.aPixel(m.valor));

  ctx.font = fuenteTitulo;
  ctx.fillStyle = COLOR_TINTA;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(ejeX.titulo, (x0 + x1) / 2, alto - 8);
  ctx.translate(10, (y0 + y1) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = "top";
  ctx.fillText(ejeY.titulo, 0, 0);
  ctx.restore();
}
