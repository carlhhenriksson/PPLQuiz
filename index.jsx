import React, { useEffect, useMemo, useState } from "react";

const FILES = [
  { course: "050 Meteorologi", url: "./050_Meteorologi_fragor_och_svar.txt" },
  { course: "060 Navigation", url: "./060_Navigation_fragor_och_svar.txt" },
  { course: "090 Kommunikation", url: "./090_Kommunikation_fragor_och_svar.txt" },
];

const SAMPLE = `050 Meteorologi
===============

1. [050 01 01 00] Atmosfären - nivå 1
Fråga: Vad är troposfären?
Rätt svar: Atmosfärens lägsta skikt där nästan allt väder uppstår
Fel svar: Skiktet direkt ovanför tropopausen där väder normalt uppstår | Atmosfärens lägsta skikt, men bara där temperaturen är konstant | Skiktet mellan stratosfären och mesosfären där moln bildas
Förklaring: Troposfären är viktigast för flygväder eftersom moln, nederbörd och turbulens huvudsakligen finns där.

060 Navigation
==============

1. [061 01 02 03] Latitud - nivå 2
Fråga: Vad motsvarar 1 minut latitud praktiskt?
Rätt svar: 1 nautisk mil
Fel svar: 1 statute mile | 1 kilometer | 1 minut longitud överallt på jorden
Förklaring: En bågminut på en meridian motsvarar 1 NM.

090 Kommunikation
=================

1. [091 04 01 00] Radiobortfall - nivå 3
Fråga: Vilken transponderkod används vid radiobortfall?
Rätt svar: 7600
Fel svar: 7700 | 7500 | 7000
Förklaring: 7600 anger radioförbindelseproblem.
`;

function linesOf(text) {
  return String(text || "")
    .replaceAll(String.fromCharCode(65279), "")
    .replaceAll(String.fromCharCode(13), "")
    .split(String.fromCharCode(10));
}

function courseFromName(name) {
  const n = String(name || "").replaceAll("_", " ");
  if (n.includes("050")) return "050 Meteorologi";
  if (n.includes("060")) return "060 Navigation";
  if (n.includes("090")) return "090 Kommunikation";
  return "Okänd kurs";
}

function looksLikeCourseTitle(s) {
  return (
    (s.startsWith("050 ") || s.startsWith("060 ") || s.startsWith("090 ")) &&
    !s.includes("[") &&
    !s.startsWith("050 0") &&
    !s.startsWith("060 0") &&
    !s.startsWith("090 0")
  );
}

function parseQuestionHeader(s) {
  const lb = s.indexOf("[");
  const rb = s.indexOf("]");
  if (!s.includes(". [") || lb < 0 || rb <= lb) return null;
  const ref = s.slice(lb + 1, rb).trim();
  const rest = s.slice(rb + 1).trim();
  const lower = rest.toLowerCase();
  const key = " - nivå ";
  const pos = lower.lastIndexOf(key);
  const area = pos >= 0 ? rest.slice(0, pos).trim() : rest;
  const levelText = pos >= 0 ? rest.slice(pos + key.length).trim() : "1";
  const level = Number(levelText) || 1;
  return { ref, area, level };
}

function parseFiles(text, fallbackCourse = "Okänd kurs") {
  const out = [];
  const warnings = [];
  let course = courseFromName(fallbackCourse) === "Okänd kurs" ? fallbackCourse : courseFromName(fallbackCourse);
  let cur = null;

  const flush = (lineNo) => {
    if (!cur) return;
    const missing = [];
    if (!cur.question) missing.push("Fråga");
    if (!cur.answer) missing.push("Rätt svar");
    if (!cur.wrong || cur.wrong.length < 3) missing.push("tre Fel svar");
    if (!cur.explanation) missing.push("Förklaring");
    if (missing.length) warnings.push(`${cur.ref || "Okänd ref"}: saknar ${missing.join(", ")} före rad ${lineNo}`);
    out.push(cur);
    cur = null;
  };

  linesOf(text).forEach((raw, i) => {
    const lineNo = i + 1;
    const s = raw.trim();
    if (!s || s.split("").every((c) => c === "=")) return;

    if (looksLikeCourseTitle(s)) {
      flush(lineNo);
      course = s;
      return;
    }

    const head = parseQuestionHeader(s);
    if (head) {
      flush(lineNo);
      cur = { id: `${course}-${out.length + 1}-${head.ref}`, course, ref: head.ref, area: head.area, level: head.level, wrong: [] };
      return;
    }

    if (!cur) return;
    if (s.startsWith("Fråga:")) cur.question = s.slice("Fråga:".length).trim();
    else if (s.startsWith("Rätt svar:")) cur.answer = s.slice("Rätt svar:".length).trim();
    else if (s.startsWith("Fel svar:")) cur.wrong = s.slice("Fel svar:".length).split("|").map((x) => x.trim()).filter(Boolean);
    else if (s.startsWith("Förklaring:")) cur.explanation = s.slice("Förklaring:".length).trim();
  });

  flush(linesOf(text).length + 1);
  return { questions: out, warnings };
}

function shuffle(a) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

function checkQuestion(q) {
  const wrong = Array.isArray(q.wrong) ? q.wrong.map((x) => String(x).trim()).filter(Boolean) : [];
  const unique = [...new Set(wrong.filter((x) => x !== q.answer))];
  if (!q.question || !q.answer || unique.length < 3) return null;
  return { ...q, wrong: unique.slice(0, 3), options: shuffle([q.answer, ...unique.slice(0, 3)]) };
}

function withOptions(items) {
  return items.map(checkQuestion).filter(Boolean).map((q, i) => ({ ...q, id: q.id || `${q.ref}-${i}` }));
}

function countByCourse(items) {
  const counts = {};
  items.forEach((q) => { counts[q.course] = (counts[q.course] || 0) + 1; });
  return counts;
}

function runTests() {
  const parsed = parseFiles(SAMPLE, "sample.txt");
  console.assert(parsed.questions.length === 3, "Parsern ska läsa 3 frågor");
  console.assert(parsed.questions[0].course === "050 Meteorologi", "Kurs ska läsas från rubrik");
  console.assert(parsed.questions[1].answer === "1 nautisk mil", "Rätt svar ska läsas korrekt");
  const opts = withOptions(parsed.questions);
  console.assert(opts.length === 3, "Alla samplefrågor ska vara giltiga");
  console.assert(opts.every((q) => q.options.length === 4), "Alla frågor ska ha fyra alternativ");
  console.assert(opts.every((q) => q.options.includes(q.answer)), "Rätt svar ska finnas bland alternativen");
  console.assert(opts[0].options.includes("Skiktet direkt ovanför tropopausen där väder normalt uppstår"), "Fel svar från fil ska användas");
}

export default function App() {
  const [questions, setQuestions] = useState([]);
  const [status, setStatus] = useState("Läser frågefiler...");
  const [log, setLog] = useState([]);
  const [course, setCourse] = useState("Alla");
  const [area, setArea] = useState("Alla");
  const [level, setLevel] = useState("Alla");
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  function applyRaw(raw, source, warnings = []) {
    const qs = withOptions(raw);
    const skipped = raw.length - qs.length;
    setQuestions(qs);
    setCourse("Alla");
    setArea("Alla");
    setLevel("Alla");
    setIdx(0);
    setPicked(null);
    setScore(0);
    setDone(false);
    const counts = countByCourse(qs);
    const countText = Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(" | ");
    setStatus(`${source}: ${qs.length} giltiga frågor.${skipped ? ` ${skipped} ogiltiga hoppades över.` : ""}`);
    setLog([countText || "Inga frågor", ...warnings.slice(0, 12)]);
  }

  useEffect(() => {
    runTests();
    Promise.all(FILES.map(async (f) => {
      const r = await fetch(f.url, { cache: "no-store" });
      if (!r.ok) throw new Error(`${f.url} gav HTTP ${r.status}`);
      const parsed = parseFiles(await r.text(), f.course);
      return { file: f.url, ...parsed };
    }))
      .then((sets) => {
        const raw = sets.flatMap((x) => x.questions);
        const warnings = sets.flatMap((x) => x.warnings.map((w) => `${x.file}: ${w}`));
        applyRaw(raw, "Automatiskt inläst från .txt", warnings);
      })
      .catch((err) => {
        const parsed = parseFiles(SAMPLE, "sample.txt");
        applyRaw(parsed.questions, "Preview kunde inte hämta .txt automatiskt, visar bara SAMPLE", [String(err.message || err), "I canvas-preview: använd Ladda filer och välj de tre .txt-filerna."]);
      });
  }, []);

  const courses = useMemo(() => ["Alla", ...new Set(questions.map((q) => q.course))], [questions]);
  const areas = useMemo(() => ["Alla", ...new Set(questions.filter((q) => course === "Alla" || q.course === course).map((q) => q.area))], [questions, course]);
  const deck = useMemo(() => questions.filter((q) => (course === "Alla" || q.course === course) && (area === "Alla" || q.area === area) && (level === "Alla" || String(q.level) === level)), [questions, course, area, level]);
  const safeIdx = Math.min(idx, Math.max(deck.length - 1, 0));
  const q = deck[safeIdx];

  function reset() {
    setIdx(0);
    setPicked(null);
    setScore(0);
    setDone(false);
  }
  function change(fn, value) {
    fn(value);
    setIdx(0);
    setPicked(null);
    setDone(false);
  }
  function answer(opt) {
    if (picked || !q) return;
    setPicked(opt);
    if (opt === q.answer) {
      setScore((s) => s + 1);
      setTimeout(next, 550);
    }
  }
  function next() {
    setPicked(null);
    if (safeIdx + 1 >= deck.length) setDone(true);
    else setIdx((n) => n + 1);
  }
  async function loadUploads(e) {
    const files = [...e.target.files];
    if (!files.length) return;
    const sets = await Promise.all(files.map(async (file) => {
      const parsed = parseFiles(await file.text(), file.name);
      return { file: file.name, ...parsed };
    }));
    const raw = sets.flatMap((x) => x.questions);
    const warnings = sets.flatMap((x) => x.warnings.map((w) => `${x.file}: ${w}`));
    applyRaw(raw, `Uppladdat ${files.length} fil(er)`, warnings);
    e.target.value = "";
  }

  return <main className="min-h-screen bg-slate-950 p-4 text-slate-100">
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="rounded-3xl bg-slate-900 p-5 shadow-xl">
        <p className="text-sm text-sky-300">LAPL/PPL quiz</p>
        <h1 className="text-3xl font-bold">Frågeträning från externa textfiler</h1>
        <p className="mt-2 text-slate-300">{status}</p>
        {log.length > 0 && <div className="mt-3 rounded-2xl bg-slate-950 p-3 text-sm text-slate-300">
          {log.map((x, i) => <div key={i}>{x}</div>)}
        </div>}
      </header>

      <section className="grid gap-3 rounded-3xl bg-slate-900 p-4 md:grid-cols-4">
        <label className="text-sm">Kurs<select className="mt-1 w-full rounded-xl bg-slate-800 p-2" value={course} onChange={(e) => change(setCourse, e.target.value)}>{courses.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="text-sm">Område<select className="mt-1 w-full rounded-xl bg-slate-800 p-2" value={area} onChange={(e) => change(setArea, e.target.value)}>{areas.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="text-sm">Nivå<select className="mt-1 w-full rounded-xl bg-slate-800 p-2" value={level} onChange={(e) => change(setLevel, e.target.value)}>{["Alla", "1", "2", "3"].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="text-sm">Ladda filer<input className="mt-1 w-full rounded-xl bg-slate-800 p-2" type="file" multiple accept=".txt" onChange={loadUploads} /></label>
      </section>

      <section className="rounded-3xl bg-slate-900 p-5 shadow-xl">
        {!q || done ? <div className="space-y-4">
          <h2 className="text-2xl font-bold">{deck.length ? "Klart!" : "Inga frågor hittades"}</h2>
          <p>Resultat: {score} / {deck.length}</p>
          <button className="rounded-2xl bg-sky-500 px-4 py-2 font-bold text-slate-950" onClick={reset}>Starta om</button>
        </div> : <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs text-slate-300"><span>{q.ref}</span><span>•</span><span>{q.course}</span><span>•</span><span>{q.area}</span><span>•</span><span>Nivå {q.level}</span><span>•</span><span>{safeIdx + 1}/{deck.length}</span></div>
          <h2 className="text-2xl font-bold">{q.question}</h2>
          <div className="grid gap-3">
            {q.options.map((opt) => {
              const right = picked && opt === q.answer;
              const wrong = picked === opt && opt !== q.answer;
              const cls = right ? "border-emerald-400 bg-emerald-900/40" : wrong ? "border-rose-400 bg-rose-900/40" : "border-slate-700 bg-slate-800 hover:bg-slate-700";
              return <button key={opt} onClick={() => answer(opt)} className={`rounded-2xl border p-4 text-left ${cls}`}>{opt}</button>;
            })}
          </div>
          {picked && picked !== q.answer && <div className="rounded-2xl border border-amber-400 bg-amber-900/30 p-4"><b>Rätt svar:</b> {q.answer}<br /><span>{q.explanation}</span><div><button className="mt-3 rounded-xl bg-sky-500 px-4 py-2 font-bold text-slate-950" onClick={next}>Nästa fråga</button></div></div>}
          <p className="text-sm text-slate-400">Poäng: {score}</p>
        </div>}
      </section>

      <footer className="rounded-3xl bg-slate-900 p-4 text-sm text-slate-400">
        I canvas-preview kan appen oftast inte hämta sandbox-filer automatiskt. Använd <b>Ladda filer</b> och välj de tre .txt-filerna. Vid deploy lägger du filerna i public/root med exakt dessa namn: <code>050_Meteorologi_fragor_och_svar.txt</code>, <code>060_Navigation_fragor_och_svar.txt</code>, <code>090_Kommunikation_fragor_och_svar.txt</code>.
      </footer>
    </div>
  </main>;
}
