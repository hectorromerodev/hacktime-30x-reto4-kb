/**
 * Clasificacion de articulos en "grupos de familia".
 *
 * El proceso real cuenta asi: "todo se cuenta a traves de grupos de familia",
 * en orden fisico del almacen. El xlsx no trae esa columna, asi que se deriva
 * por palabras clave. No pretende ser perfecta: sirve para repartir el trabajo
 * entre contadores y para agrupar el reporte, no para costear.
 */

const REGLAS: [string, string[]][] = [
  ['PREPARACIONES', ['PORCION', 'PREPARAC', 'RELLENO', 'SALSA CASERA']],
  ['ZOOLOGICO', ['ZOOLOG', 'CONCENTRADO', 'HENO', 'ALFALFA', 'CUY', 'PECES']],
  ['MEDICAMENTOS', ['JERINGA', 'AMPOLLA', 'TABLETA', 'JARABE', 'SUERO', 'VACUNA', 'ANTIBIO', 'GASA', 'VENDA', 'ALCOHOL']],
  ['QUIMICOS_PISCINA', ['CLORO', 'ALGUICIDA', 'FLOCULANTE', 'SULFATO', 'PH ', 'ACIDO MURIA', 'HIPOCLORITO']],
  ['ASEO', ['DETERGENTE', 'JABON', 'DESINFECT', 'LIMPIA', 'ESCOBA', 'TRAPEA', 'AMBIENTADOR', 'BLANQUEADOR', 'GUANTE', 'BOLSA NEGRA', 'BOLSA BLANCA', 'PAPEL HIGIEN', 'TOALLA MANO', 'ANTIMICROBIANO']],
  ['CARNES', ['CARNE', 'POLLO', 'CERDO', 'RES ', 'LOMO', 'COSTILLA', 'CHORIZO', 'JAMON', 'TOCINETA', 'PECHUGA', 'MOJARRA', 'PESCADO', 'CAMARON', 'CADERA', 'PUNTA DE ANCA', 'SOBREBARRIGA']],
  ['LACTEOS', ['LECHE', 'QUESO', 'YOGURT', 'MANTEQUILLA', 'CREMA DE LECHE', 'KUMIS', 'AREQUIPE']],
  ['FRUVER', ['LECHUGA', 'TOMATE', 'CEBOLLA', 'PAPA', 'ZANAHORIA', 'BANANO', 'MANZANA', 'NARANJA', 'LIMON', 'AGUACATE', 'PLATANO', 'ACELGA', 'ESPINACA', 'PIMENTON', 'CILANTRO', 'YUCA', 'MANGO', 'PINA', 'FRESA', 'MORA', 'MARACUYA', 'PEPINO', 'BROCOLI', 'REPOLLO', 'AJO', 'HABICHUELA']],
  ['CONGELADOS', ['CONGELAD', 'HELADO', 'PALETA']],
  ['BEBIDAS', ['GASEOSA', 'JUGO', 'AGUA ', 'CERVEZA', 'REFRESCO', 'BEBIDA', 'CAFE', 'AROMATICA', 'TE ', 'MALTA', 'HIDRATANTE']],
  ['PANADERIA', ['PAN ', 'PANDEBONO', 'ALMOJABANA', 'CROISSANT', 'GALLETA', 'TORTA', 'PONQUE', 'HARINA', 'LEVADURA']],
  ['ABARROTES', ['ARROZ', 'ACEITE', 'AZUCAR', 'SAL ', 'PASTA', 'FRIJOL', 'LENTEJA', 'GARBANZO', 'ATUN', 'SARDINA', 'SALSA', 'VINAGRE', 'CONDIMENTO', 'ESPECIA', 'CALDO', 'MAIZ', 'AVENA', 'PANELA', 'CHOCOLATE', 'MAYONESA', 'MOSTAZA', 'ADEREZO']],
  ['DESECHABLES', ['DESECHABLE', 'VASO', 'PLATO', 'SERVILLETA', 'BOLSA', 'PITILLO', 'CONTENEDOR', 'PORTACOMIDA', 'PAPEL ALUMINIO', 'VINIPEL', 'CUBIERTO PLAS']],
  ['MENAJE', ['CUCHILLO', 'CUCHARA', 'TENEDOR', 'OLLA', 'SARTEN', 'BANDEJA', 'CAZUELA', 'TABLA ACRILICA', 'BALDE', 'CANASTILLA', 'RECIPIENTE', 'PINZA', 'COLADOR', 'JARRA', 'SAMOVAR', 'PORCIONADORA']],
  ['PAPELERIA', ['ARCHIVADOR', 'TONER', 'RESMA', 'LAPICERO', 'MARCADOR', 'CARPETA', 'GRAPADORA', 'CINTA', 'SOBRE ']],
];

/**
 * @param nombreNormalizado nombre ya pasado por `normalizar()` (MAYUSCULAS, sin acentos)
 * @param calificador contenido del parentesis final, si lo habia
 */
export function clasificarFamilia(
  nombreNormalizado: string,
  calificador: string | null,
): string {
  // Los calificadores del propio catalogo mandan sobre las palabras clave.
  if (calificador === 'PA') return 'PREPARACIONES';
  if (calificador?.includes('ZOOLOGICO')) return 'ZOOLOGICO';

  for (const [familia, claves] of REGLAS) {
    for (const clave of claves) {
      if (nombreNormalizado.includes(clave)) return familia;
    }
  }
  return 'OTROS';
}

export const FAMILIAS = [...new Set(REGLAS.map(([f]) => f)), 'OTROS'];
