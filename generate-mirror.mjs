import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certreadyRoot = 'C:\\dev\\certready';
const requireFromCertready = createRequire(path.join(certreadyRoot, 'package.json'));
const { chromium } = requireFromCertready('playwright');

const packetDir = path.join(certreadyRoot, 'docs', 'submission', 'montana', 'kent-core-packet-2026-06-01');

const tracks = [
  {
    slug: 'mt-alcohol',
    label: 'On-premises',
    file: 'on-premises.html',
    examFile: 'exam-on-premises.html',
    reviewerEmail: 'mt-reviewer@certready.org',
    minMinutes: 120,
    modules: 8,
    examDraw: 40,
    pool: 64,
    coursePdf: 'mt-alcohol-full-course-content.pdf',
    title: 'Montana RASS On-Premises',
    audience: 'bars, restaurants, breweries, tasting rooms, and other places where alcohol is served for consumption on site.',
  },
  {
    slug: 'mt-alcohol-offsale',
    label: 'Off-premises',
    file: 'off-premises.html',
    examFile: 'exam-off-premises.html',
    reviewerEmail: 'mt-offsale-reviewer@certready.org',
    minMinutes: 60,
    modules: 6,
    examDraw: 25,
    pool: 40,
    coursePdf: 'mt-alcohol-offsale-full-course-content.pdf',
    title: 'Montana RASS Off-Premises',
    audience: 'grocery stores, convenience stores, package sales, and other sealed-container retail settings.',
  },
];

const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(certreadyRoot, file), 'utf8'));
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/â€”|â€“|—|–/g, '-')
    .replace(/â‰¥|≥/g, 'at least')
    .replace(/â‰¤|≤/g, 'at most')
    .replace(/â‰ˆ|≈/g, 'about')
    .replace(/Ã—|×/g, 'x')
    .replace(/â€¢|•/g, '-')
    .replace(/Â§/g, 'Section ')
    .replace(/Â/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\uFFFD/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function value(input, lang = 'en') {
  if (input == null) return '';
  if (typeof input === 'object' && !Array.isArray(input)) return cleanText(input[lang] ?? input.en ?? input.text ?? '');
  return cleanText(input);
}

function esc(input) {
  return cleanText(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineMd(input) {
  return esc(input).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function blockMd(input) {
  const text = cleanText(input);
  if (!text) return '';
  const rawLines = text.split(/(?:<br\s*\/?>|\n)/i).map((line) => cleanText(line)).filter(Boolean);
  const lines = rawLines.flatMap((line) => {
    if (line.includes(' - ') && line.split(' - ').length > 2) return line.split(' - ').map((part) => cleanText(part)).filter(Boolean);
    return [line];
  });
  const bullets = lines.filter((line) => /^[-*]\s+/.test(line));
  if (bullets.length >= 2 && bullets.length === lines.length) {
    return `<ul>${bullets.map((line) => `<li>${inlineMd(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
  }
  return lines.map((line) => `<p>${inlineMd(line.replace(/^[-*]\s+/, ''))}</p>`).join('');
}

function html(title, body, extraClass = '') {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="${extraClass === 'module' ? '../' : ''}style.css">
</head>
<body>
  <header>
    <a class="brand" href="${extraClass === 'module' ? '../' : ''}index.html">CertReady Montana RASS Review</a>
    <nav>
      <a href="${extraClass === 'module' ? '../' : ''}on-premises.html">On-premises</a>
      <a href="${extraClass === 'module' ? '../' : ''}off-premises.html">Off-premises</a>
      <a href="${extraClass === 'module' ? '../' : ''}exam-on-premises.html">On-prem exam</a>
      <a href="${extraClass === 'module' ? '../' : ''}exam-off-premises.html">Off-prem exam</a>
      <a href="${extraClass === 'module' ? '../' : ''}index.html#pdfs">PDFs</a>
    </nav>
  </header>
  <main>${body}</main>
  <footer>CertReady - Practical AI Solutions LLC - Review mirror generated June 1, 2026</footer>
</body>
</html>`;
}

function optionList(rawOptions) {
  if (!rawOptions) return [];
  const source = rawOptions.en ?? rawOptions;
  return source.map((opt, index) => {
    if (typeof opt === 'object') {
      return { id: cleanText(opt.id ?? letters[index]), text: value(opt.text) };
    }
    return { id: letters[index], text: value(opt) };
  });
}

function answerId(question, options) {
  const raw = question.correctAnswer ?? question.answer;
  if (typeof raw === 'number') return options[raw]?.id ?? String(raw);
  if (typeof raw === 'boolean') {
    const target = raw ? 'true' : 'false';
    return options.find((opt) => opt.id.toLowerCase() === target || opt.text.toLowerCase() === target)?.id ?? target;
  }
  const rawText = cleanText(raw);
  if (/^\d+$/.test(rawText)) return options[Number(rawText)]?.id ?? rawText;
  return rawText.toLowerCase();
}

function readableAnswer(question, options) {
  const id = answerId(question, options);
  const found = options.find((opt) => opt.id.toLowerCase() === id || opt.text.toLowerCase() === id);
  if (!found) return esc(id);
  return `${esc(found.id)}. ${esc(found.text)}`;
}

function optionsHtml(question) {
  const options = optionList(question.options);
  const correct = answerId(question, options);
  return `<ol class="options">${options.map((opt) => {
    const isCorrect = opt.id.toLowerCase() === correct || opt.text.toLowerCase() === correct;
    return `<li class="${isCorrect ? 'correct' : ''}"><strong>${esc(opt.id)}.</strong> ${esc(opt.text)}${isCorrect ? ' <span>Correct</span>' : ''}</li>`;
  }).join('')}</ol>`;
}

function imageName(slug, moduleId, chunkId) {
  const mod = moduleId.replace(/^module-/, '').replace(/^0?/, '').padStart(2, '0');
  const prefix = slug === 'mt-alcohol-offsale' ? 'MT-ALCOHOL-OFFSALE' : 'MT-ALCOHOL';
  const jpg = `${prefix}-M${mod}-${chunkId}.jpg`;
  return fs.existsSync(path.join(__dirname, 'img', jpg)) ? jpg : null;
}

function chunkHtml(chunk, slug, moduleId, modulePage = false) {
  const type = cleanText(chunk.type || 'text');
  const meta = [cleanText(chunk.id), type].filter(Boolean).join(' | ');
  const outcomes = Array.isArray(chunk.outcomes) && chunk.outcomes.length ? `<p class="fine"><strong>Outcomes:</strong> ${esc(chunk.outcomes.join(', '))}</p>` : '';
  const img = imageName(slug, moduleId, chunk.id);
  const imgHtml = img ? `<figure><img src="${modulePage ? '../' : ''}img/${esc(img)}" alt="${esc(img.replace(/\.jpg$/, ' infographic'))}"><figcaption>${esc(img.replace(/\.jpg$/, '').replace(/-/g, ' '))}</figcaption></figure>` : '';

  if (['multiple_choice', 'true_false'].includes(type)) {
    return `<article class="chunk ${esc(type)}"><div class="chunk-meta">${esc(meta)}</div><p>${inlineMd(value(chunk.question))}</p><h4>Options</h4>${optionsHtml(chunk)}<p class="answer"><strong>Correct answer:</strong> ${readableAnswer(chunk, optionList(chunk.options))}</p>${outcomes}</article>`;
  }

  if (type === 'short_answer') {
    const keywords = Array.isArray(chunk.acceptedKeywords) ? chunk.acceptedKeywords.join(', ') : value(chunk.acceptedKeywords);
    return `<article class="chunk ${esc(type)}"><div class="chunk-meta">${esc(meta)}</div><p>${inlineMd(value(chunk.question) || value(chunk.prompt) || value(chunk.content))}</p>${keywords ? `<p class="answer"><strong>Accepted keywords:</strong> ${esc(keywords)}</p>` : ''}${outcomes}</article>`;
  }

  const prompt = value(chunk.prompt || chunk.question);
  const content = value(chunk.content || chunk.text || chunk.body);
  const optionBlock = chunk.options ? `<h4>Options</h4>${optionsHtml(chunk)}` : '';
  return `<article class="chunk ${esc(type)}"><div class="chunk-meta">${esc(meta)}</div>${prompt ? `<p><strong>${inlineMd(prompt)}</strong></p>` : ''}${blockMd(content)}${optionBlock}${imgHtml}${outcomes}</article>`;
}

function modulePage(track, moduleFile) {
  const mod = readJson(`courses/${track.slug}/modules/${moduleFile}`);
  const moduleId = moduleFile.replace('.json', '');
  const number = moduleId.replace('module-', '');
  const sections = (mod.sections || []).map((section) => {
    const chunks = (section.chunks || []).map((chunk) => chunkHtml(chunk, track.slug, moduleId, true)).join('\n');
    return `<section><h3>${esc(value(section.title) || section.id || 'Section')}</h3>${chunks}</section>`;
  }).join('\n');
  const quizQuestions = mod.quiz?.questions || [];
  const quiz = quizQuestions.length ? `<section class="quiz"><h3>Module ${Number(number)} Quiz</h3><p class="fine">Passing score: ${esc(mod.quiz.passingScore || 80)}%</p>${quizQuestions.map((q) => chunkHtml(q, track.slug, moduleId, true)).join('\n')}</section>` : '';
  const body = `<section class="hero compact">
    <p class="eyebrow">${esc(track.label)} course module</p>
    <h1>Module ${esc(number)}: ${esc(value(mod.title))}</h1>
    <p class="lead">${esc(value(mod.subtitle) || `Reviewer preview of this ${track.label.toLowerCase()} module.`)}</p>
    <p>This page mirrors the student lesson content and infographics so Montana CARD can review it without using the CertReady LMS.</p>
  </section>${sections}${quiz}`;
  fs.writeFileSync(path.join(__dirname, 'modules', `${track.slug}-${number}.html`), html(`Module ${number}: ${value(mod.title)}`, body, 'module'));
}

function trackPage(track) {
  const config = readJson(`courses/${track.slug}/course-config.json`);
  const moduleFiles = fs.readdirSync(path.join(certreadyRoot, 'courses', track.slug, 'modules')).filter((f) => f.endsWith('.json')).sort();
  moduleFiles.forEach((file) => modulePage(track, file));
  const cards = moduleFiles.map((file) => {
    const mod = readJson(`courses/${track.slug}/modules/${file}`);
    const number = file.match(/(\d+)/)?.[1] ?? file;
    return `<a class="card module-card" href="modules/${track.slug}-${number}.html"><strong>Module ${Number(number)}: ${esc(value(mod.title))}</strong><span>${esc(value(mod.subtitle) || `${mod.estimatedMinutes || ''} minute module`)}</span></a>`;
  }).join('');
  const body = `<section class="hero compact">
    <p class="eyebrow">${esc(track.label)} track</p>
    <h1>${esc(track.title)}</h1>
    <p class="lead">This track is for ${esc(track.audience)}</p>
    <div class="summary-line"><strong>${track.minMinutes}-minute minimum.</strong><strong>${track.modules} modules.</strong><strong>${track.examDraw}-question final exam.</strong></div>
  </section>
  <section class="plain-panel">
    <h2>What is on this page</h2>
    <p>Click any module below to review the lesson text, scenarios, quiz items, and infographics. The live CertReady LMS also includes the student progress gates, video overviews, audio overviews, English narration, and Spanish browser text-to-speech.</p>
    <p><a href="${esc(track.examFile)}">Open the ${esc(track.label.toLowerCase())} final exam preview</a> or <a href="pdf/${esc(track.coursePdf)}">download this track as a PDF</a>.</p>
  </section>
  <section>
    <h2>Modules</h2>
    <div class="grid modules-grid">${cards}</div>
  </section>`;
  fs.writeFileSync(path.join(__dirname, track.file), html(`${track.title} Review`, body));
}

function examPage(track) {
  const exam = readJson(`courses/${track.slug}/exams/final-exam.json`);
  const questions = exam.questionPool || [];
  const rows = questions.map((q) => {
    const meta = [q.id, q.moduleId ? `Module ${q.moduleId}` : '', q.outcomes?.join(', ') || ''].filter(Boolean).join(' | ');
    return `<article class="chunk exam-question"><div class="chunk-meta">${esc(meta)}</div><p><strong>${inlineMd(value(q.question))}</strong></p>${optionsHtml(q)}<p class="answer"><strong>Correct answer:</strong> ${readableAnswer(q, optionList(q.options))}</p>${value(q.explanation) ? `<p>${inlineMd(value(q.explanation))}</p>` : ''}</article>`;
  }).join('\n');
  const body = `<section class="hero compact">
    <p class="eyebrow">${esc(track.label)} final exam</p>
    <h1>${esc(track.title)} Final Exam Preview</h1>
    <p class="lead">This preview shows the regulator-facing question pool and correct answers. Students see a randomized exam and do not see the answer key.</p>
    <div class="summary-line"><strong>Pass score: 80%.</strong><strong>${track.examDraw} questions per attempt.</strong><strong>${questions.length}-question pool.</strong></div>
  </section>
  <section class="plain-panel">
    <h2>What Montana CARD can check here</h2>
    <p>Each question includes the question text, answer choices, the correct answer, and the teaching explanation. Correct answers are highlighted in green for review only.</p>
  </section>
  <section><h2>Question Pool</h2>${rows}</section>`;
  fs.writeFileSync(path.join(__dirname, track.examFile), html(`${track.label} Exam`, body));
}

function indexPage() {
  const body = `<section class="hero">
    <p class="eyebrow">Alternate access path for Montana CARD</p>
    <h1>CertReady Montana RASS Review</h1>
    <p class="lead">This backup review site is hosted on GitHub Pages in case Montana's email or web filters block the CertReady domain.</p>
    <p>It is a static mirror of the course text, exam previews, infographics, and core review PDFs. It does not require login, tracking, or an app session.</p>
  </section>
  <section class="plain-panel">
    <h2>What to review first</h2>
    <ol class="steps">
      <li><strong>Open a course track.</strong> Review modules, scenarios, quiz items, and infographics.</li>
      <li><strong>Open an exam preview.</strong> Confirm the final exam pool, pass score, retake framing, and answer explanations.</li>
      <li><strong>Download the PDFs.</strong> Use the separate files below if attachments are easier for your office.</li>
      <li><strong>Try the live LMS if CertReady is whitelisted.</strong> The LMS shows the student experience, video overviews, audio overviews, narration, progress gates, and certificate flow.</li>
    </ol>
  </section>
  <section>
    <h2>Course Click-Through</h2>
    <div class="grid">
      <a class="card" href="on-premises.html"><strong>On-premises course</strong><span>120-minute minimum, 8 modules, 40-question final exam.</span></a>
      <a class="card" href="off-premises.html"><strong>Off-premises course</strong><span>60-minute minimum, 6 modules, 25-question final exam.</span></a>
      <a class="card" href="exam-on-premises.html"><strong>On-premises exam preview</strong><span>64-question pool, 40 drawn per attempt.</span></a>
      <a class="card" href="exam-off-premises.html"><strong>Off-premises exam preview</strong><span>40-question pool, 25 drawn per attempt.</span></a>
    </div>
  </section>
  <section>
    <h2>Live LMS Login</h2>
    <p>If the CertReady domain is whitelisted, these reviewer accounts open the real student LMS and bypass time gates. This is the best way to see the student experience, including videos and audio.</p>
    <div class="credential-grid">
      <div><span>Login URL</span><a href="https://www.certready.org/login">https://www.certready.org/login</a></div>
      <div><span>On-premises reviewer email</span><strong>mt-reviewer@certready.org</strong></div>
      <div><span>On-premises password</span><strong>testing</strong></div>
      <div><span>Off-premises reviewer email</span><strong>mt-offsale-reviewer@certready.org</strong></div>
      <div><span>Off-premises password</span><strong>testing</strong></div>
    </div>
  </section>
  <section id="pdfs">
    <h2>Core Review PDFs</h2>
    <p>These are the practical first-review documents. The full course PDFs include the course text, quiz items, answer keys, exam previews, and infographics.</p>
    <div class="pdf-list">
      <a href="pdf/cover-letter.pdf">Cover letter <span>Provider overview and submission context.</span></a>
      <a href="pdf/curriculum-outline.pdf">Curriculum outline <span>Track structure, module list, learning outcomes.</span></a>
      <a href="pdf/mt-alcohol-full-course-content.pdf">Full content - On-premises <span>Complete course text, quizzes, exam pool, and infographics.</span></a>
      <a href="pdf/mt-alcohol-offsale-full-course-content.pdf">Full content - Off-premises <span>Complete course text, quizzes, exam pool, and infographics.</span></a>
      <a href="pdf/content-map.pdf">Content map <span>Rules and statutes mapped to course locations.</span></a>
      <a href="pdf/scoring-methodology.pdf">Scoring methodology <span>Exam rules, pass score, retake handling.</span></a>
      <a href="pdf/completion-reporting-workflow.pdf">Reporting workflow <span>Completion record fields and reporting process.</span></a>
    </div>
  </section>`;
  fs.writeFileSync(path.join(__dirname, 'index.html'), html('CertReady Montana RASS Review', body));
}

function printPage(track) {
  const config = readJson(`courses/${track.slug}/course-config.json`);
  const moduleFiles = fs.readdirSync(path.join(certreadyRoot, 'courses', track.slug, 'modules')).filter((f) => f.endsWith('.json')).sort();
  const modules = moduleFiles.map((file) => {
    const mod = readJson(`courses/${track.slug}/modules/${file}`);
    const number = file.match(/(\d+)/)?.[1] ?? file;
    const sections = (mod.sections || []).map((section) => `<section><h3>${esc(value(section.title) || section.id || 'Section')}</h3>${(section.chunks || []).map((chunk) => chunkHtml(chunk, track.slug, `module-${number}`, false)).join('\n')}</section>`).join('\n');
    const quizQuestions = mod.quiz?.questions || [];
    const quiz = quizQuestions.length ? `<section class="quiz"><h3>Module ${Number(number)} Quiz</h3><p class="fine">Passing score: ${esc(mod.quiz.passingScore || 80)}%</p>${quizQuestions.map((q) => chunkHtml(q, track.slug, `module-${number}`, false)).join('\n')}</section>` : '';
    return `<section class="module-print"><h2>Module ${Number(number)}: ${esc(value(mod.title))}</h2>${value(mod.subtitle) ? `<p class="lead small">${esc(value(mod.subtitle))}</p>` : ''}${sections}${quiz}</section>`;
  }).join('\n');
  const exam = readJson(`courses/${track.slug}/exams/final-exam.json`);
  const examRows = (exam.questionPool || []).map((q) => {
    const meta = [q.id, q.moduleId ? `Module ${q.moduleId}` : '', q.outcomes?.join(', ') || ''].filter(Boolean).join(' | ');
    return `<article class="chunk exam-question"><div class="chunk-meta">${esc(meta)}</div><p><strong>${inlineMd(value(q.question))}</strong></p>${optionsHtml(q)}<p class="answer"><strong>Correct answer:</strong> ${readableAnswer(q, optionList(q.options))}</p>${value(q.explanation) ? `<p>${inlineMd(value(q.explanation))}</p>` : ''}</article>`;
  }).join('\n');
  const body = `<section class="hero compact print-cover">
    <p class="eyebrow">${esc(track.label)} track</p>
    <h1>${esc(track.title)} Full Course Content</h1>
    <p class="lead">Regulator review copy with lesson text, infographics, module quizzes, answer keys, and final exam preview.</p>
    <div class="summary-line"><strong>${track.minMinutes}-minute minimum.</strong><strong>${track.modules} modules.</strong><strong>${track.examDraw}-question final exam.</strong></div>
  </section>
  <section class="plain-panel">
    <h2>How to read this PDF</h2>
    <p>This PDF is organized in course order. Each module includes the student-facing lesson content first, then quiz questions and correct answers. The final section contains the final exam question pool with correct answers highlighted for regulator review.</p>
  </section>
  ${modules}
  <section class="module-print"><h2>Final Exam Preview</h2><p>The student exam is randomized. This review copy shows the full pool and answer explanations so CARD can evaluate coverage and scoring.</p>${examRows}</section>`;
  const file = path.join(__dirname, `_${track.slug}-print.html`);
  fs.writeFileSync(file, html(`${track.title} Full Course Content`, body));
  return file;
}

function stylesheet() {
  fs.writeFileSync(path.join(__dirname, 'style.css'), `:root{--navy:#193a63;--ink:#10233f;--muted:#5f6f86;--teal:#00a884;--sky:#e7f4ff;--line:#d6e0ec;--soft:#f7fafc;--green:#0f7a4f;--green-soft:#e8f7ef}*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;color:var(--ink);background:#fff;line-height:1.58}header{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:16px 44px;background:#fff;border-bottom:1px solid var(--line)}a{color:#006fbd;text-decoration:underline;text-underline-offset:3px;font-weight:700}a:hover{color:#004f8f}.brand{font-size:18px;color:var(--navy);text-decoration:none}nav{display:flex;gap:16px;flex-wrap:wrap}nav a{font-size:14px;color:#24527d}main{max-width:1040px;margin:0 auto;padding:42px 28px 64px}.hero{padding:38px 0 32px}.hero.compact{padding:26px 0 24px}.eyebrow{text-transform:uppercase;letter-spacing:.08em;color:#63758e;font-size:13px;font-weight:800;margin:0 0 10px}h1{font-size:42px;line-height:1.12;margin:0 0 16px;color:var(--navy)}h2{font-size:28px;line-height:1.2;margin:42px 0 14px;color:var(--navy);border-bottom:2px solid var(--line);padding-bottom:10px}h3{font-size:21px;margin:30px 0 12px;color:#244766}h4{margin:16px 0 8px}.lead{font-size:19px;color:#223957;max-width:850px}.lead.small{font-size:16px}.summary-line{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}.summary-line strong{display:inline-block;padding:10px 14px;border-left:5px solid var(--teal);background:#f4f8fb;border-radius:4px}.plain-panel{background:#f8fbfd;border:1px solid var(--line);border-left:5px solid var(--teal);padding:20px 24px;margin:22px 0 30px;border-radius:4px}.steps{padding-left:22px}.steps li{margin:8px 0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.card{display:block;padding:20px;border:1px solid var(--line);border-radius:6px;text-decoration:none;color:var(--ink);background:#fff;box-shadow:0 1px 2px rgba(16,35,63,.06)}.card:hover{border-color:#81bfe8;background:#f8fcff}.card strong{display:block;color:var(--navy);font-size:18px;margin-bottom:8px}.card span{display:block;color:var(--muted);font-weight:500}.module-card strong{font-size:16px}.credential-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}.credential-grid div{border:1px solid var(--line);background:#f8fbfd;border-radius:6px;padding:14px}.credential-grid span{display:block;text-transform:uppercase;letter-spacing:.06em;font-size:12px;font-weight:800;color:#64748b;margin-bottom:5px}.credential-grid strong,.credential-grid a{font-family:Consolas,Menlo,monospace;color:#007f6d;font-size:17px;overflow-wrap:anywhere}.pdf-list{display:grid;gap:12px}.pdf-list a{display:block;padding:15px 18px;border:1px solid var(--line);border-radius:6px;background:#fff;color:#006fbd}.pdf-list span{display:block;color:var(--muted);font-weight:500;margin-top:3px}.chunk{break-inside:avoid;margin:18px 0;padding:18px 20px;border:1px solid var(--line);border-radius:6px;background:#fff}.chunk-meta{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6b7b91;font-weight:800;margin-bottom:10px}.chunk p{margin:9px 0}.options{padding-left:24px}.options li{margin:7px 0;padding:6px 8px;border-radius:4px}.options li.correct{background:var(--green-soft);border-left:4px solid var(--green)}.options li span{color:var(--green);font-weight:800;margin-left:8px}.answer{color:#0d6844;background:#eefaf3;border-left:4px solid var(--green);padding:8px 10px}.fine{font-size:13px;color:#65758a}figure{margin:16px 0;border:1px solid var(--line);border-radius:6px;padding:10px;background:#fbfdff}figure img{display:block;max-width:100%;height:auto;margin:0 auto}figcaption{font-size:12px;color:#6b7b91;text-align:center;margin-top:8px}.module-print{break-before:auto}footer{border-top:1px solid var(--line);padding:22px 44px;color:#65758a;font-size:13px}@media(max-width:760px){header{position:static;padding:14px 20px;align-items:flex-start;flex-direction:column}main{padding:28px 18px 48px}h1{font-size:32px}.grid,.credential-grid{grid-template-columns:1fr}.summary-line{display:block}.summary-line strong{display:block;margin:8px 0}}@media print{header,footer{display:none}main{max-width:none;padding:0 26px}.hero{padding-top:0}body{font-size:12px}h1{font-size:30px}h2{font-size:21px;margin-top:26px}h3{font-size:16px}.lead{font-size:14px}.chunk{padding:10px 12px;margin:10px 0}.plain-panel{padding:12px 14px}.summary-line strong{padding:7px 9px}.options li{margin:3px 0;padding:3px 5px}figure img{max-height:4.6in;object-fit:contain}.print-cover{break-after:avoid}}`);
}

async function renderPdf(sourceHtml, outputName) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(pathToFileURL(sourceHtml).href, { waitUntil: 'networkidle' });
  await page.pdf({
    path: path.join(packetDir, outputName),
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.5in', right: '0.5in', bottom: '0.55in', left: '0.5in' },
  });
  await browser.close();
  fs.copyFileSync(path.join(packetDir, outputName), path.join(__dirname, 'pdf', outputName));
}

function copyStaticPdfs() {
  fs.mkdirSync(path.join(__dirname, 'pdf'), { recursive: true });
  for (const name of ['cover-letter.pdf', 'curriculum-outline.pdf', 'content-map.pdf', 'scoring-methodology.pdf', 'completion-reporting-workflow.pdf']) {
    fs.copyFileSync(path.join(packetDir, name), path.join(__dirname, 'pdf', name));
  }
}

async function main() {
  fs.mkdirSync(path.join(__dirname, 'modules'), { recursive: true });
  stylesheet();
  copyStaticPdfs();
  indexPage();
  for (const track of tracks) {
    trackPage(track);
    examPage(track);
    const printHtml = printPage(track);
    await renderPdf(printHtml, track.coursePdf);
  }
}

await main();
