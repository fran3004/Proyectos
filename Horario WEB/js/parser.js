// Parsea uno o varios archivos MATERIAS.txt (HTML de Academusoft) y genera archivos horarios.json / horarios.js
const fs = require('fs');
const path = require('path');

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// El archivo mezcla latin-1 y UTF-8: repara secuencias tipo "SALÃ“N" -> "SALÓN"
function fixEnc(s) {
  if (!s || !s.includes('Ã')) return s;
  const fixed = Buffer.from(s, 'latin1').toString('utf8');
  return fixed.includes('�') ? s : fixed;
}

function parseHtmlToCourses(html) {
  // Divide el documento por encabezados de materia
  const headerRe = /colspan="7">([A-Z]{2,3}\d+[A-Z]?)\s*-\s*(.*?)\s*-\s*Estado\s*:\s*(\w+)<\/td>/g;
  const headers = [];
  let m;
  while ((m = headerRe.exec(html)) !== null) {
    headers.push({ code: m[1], name: m[2].trim(), status: m[3], index: m.index });
  }

  const courses = [];
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index;
    const end = i + 1 < headers.length ? headers[i + 1].index : html.length;
    const section = html.slice(start, end);

    // Cada columna de día es <td width="1X%" class="text_negro" valign="top"> con una tabla interna
    const colRe = /<td width="1[46]%" class="text_negro" valign="top">([\s\S]*?)<\/table><\/td>/g;
    const groups = {}; // nombre de grupo -> sesiones
    let col, dayIdx = 0;
    while ((col = colRe.exec(section)) !== null) {
      const day = DAYS[dayIdx] || 'Desconocido';
      const blockRe = /<p>\s*Grupo\s*:\s*([\s\S]*?)<\/p>/g;
      let b;
      while ((b = blockRe.exec(col[1])) !== null) {
      // Quitar caracteres '>' sobrantes y normalizar espacios en cada parte
      const parts = b[1].split(/<br\s*\/?/i).map(s => {
        let x = fixEnc(s.replace(/\s+/g, ' '));
        // limpiar prefijos '>' y espacios: "> 301" -> "301"
        x = x.replace(/^>+\s*/, '');
        return x.trim();
      });
      // parts: [nombreGrupo, docente, salón, hora, fechaInicio, fechaFin]
      let [gname, teacher, room, time, dstart, dend] = parts;
      gname = (gname || '').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim();
      teacher = (teacher || '').replace(/^>+\s*/, '').trim();
      room = (room || '').replace(/^>+\s*/, '').trim();
      time = (time || '').replace(/^>+\s*/, '').trim();
      dstart = (dstart || '').replace(/^>+\s*/, '').trim();
      dend = (dend || '').replace(/^>+\s*/, '').trim();

      const [tstart, tend] = (time || '').split('-').map(s => s.trim());
      const key = gname;
      if (!groups[key]) groups[key] = { name: key, teacher: teacher || '', sessions: [], start: dstart || '', end: dend || '' };
      groups[key].sessions.push({ day, dayIdx, room: room || '', start: tstart || '', end: tend || '' });
    }
      dayIdx++;
    }
    if (dayIdx !== 7) console.warn(`AVISO: ${headers[i].code} tiene ${dayIdx} columnas de día (se esperaban 7)`);

    courses.push({
      code: headers[i].code,
      name: headers[i].name,
      status: headers[i].status,
      groups: Object.values(groups),
    });
  }
  return courses;
}

// --- argumentos: node parser.js [file1 [file2 ...]] [--programs "Name1;Name2"]
const args = process.argv.slice(2);
let files = [];
let programNames = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--programs') {
    if (i + 1 < args.length) { programNames = args[i + 1].split(';'); i++; }
  } else {
    files.push(args[i]);
  }
}

const inputFiles = files.length ? files : ['MATERIAS.txt'];

inputFiles.forEach((fname, idx) => {
  const fpath = path.join(__dirname, fname);
  if (!fs.existsSync(fpath)) { console.error(`No existe el archivo ${fpath}`); return; }
  const html = fs.readFileSync(fpath, 'latin1');
  const courses = parseHtmlToCourses(html);
  const program = programNames[idx] || (idx === 0 ? 'INGENIERIA DE SISTEMAS' : `PROGRAMA ${idx + 1}`);
  const period = '2026-2';
  const out = { program, period, courses };

  const jsVar = idx === 0 ? 'HORARIOS_DATA' : `HORARIOS_DATA_${idx + 1}`;
  const jsonName = idx === 0 ? 'horarios.json' : `horarios_${idx + 1}.json`;
  const jsName = idx === 0 ? 'horarios.js' : `horarios_${idx + 1}.js`;

  fs.writeFileSync(path.join(__dirname, jsonName), JSON.stringify(out, null, 1), 'utf8');
  fs.writeFileSync(path.join(__dirname, jsName), `window.${jsVar} = ${JSON.stringify(out)};`, 'utf8');

  const totalGroups = courses.reduce((a, c) => a + c.groups.length, 0);
  const totalSessions = courses.reduce((a, c) => a + c.groups.reduce((x, g) => x + g.sessions.length, 0), 0);
  console.log(`${fname} -> ${jsName} | Materias: ${courses.length} | Grupos: ${totalGroups} | Sesiones: ${totalSessions}`);
});
