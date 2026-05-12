import { readFile, writeFile } from 'fs/promises';
import { glob } from 'glob';
import matter from 'gray-matter';
import {JSDOM} from "jsdom";
import { marked } from "marked";

const framework = new Map();


const ewp = JSON.parse(await readFile("_tools/ewp.json", 'utf-8'));

const files = (await glob('{impact-statements,outcomes,outputs,activities,inputs,indicators}/*.md')).sort();

for (const file of files) {

  let fileContent;
  try {
    fileContent = matter(await readFile(file, 'utf8'));
  } catch (e) {
    throw new Error(`Failed to parse ${file} as markdown with YAML front matter`, {cause: e});
  }
  const { data, content } = fileContent;
  const level = file.split('/')[0];
  // Where is getOrInsert when you need it? not in node
  if (!framework.get(level)) {
    framework.set(level, new Map());
  }
  const levelMap = framework.get(level);
  levelMap.set(data.id, {data, content});
};

const levelFormat = {
  "outcomes": {
    level: 3,
    prefix: "🎯 Outcome:",
    contains: "outputs",
  },
  "outputs": {
    level: 4,
    prefix: "Output:",
    contains: "activities"
  },
};

function formatIndicators(indicators, level) {
  return `
<section class=indicators><h${level}>📈 Indicators</h${level}>
<ul>
${indicators.map(i => {
 return `<li>${framework.get("indicators").get(i).data.title}</li>`;
}).join("\n")}
</ul>
</section>
`;
}

function formatLevel(type, id, document) {
  const object = framework.get(type)?.get(id);
  const format = levelFormat[type];
  if (!object) {
    console.error(`Invalid ${type} id ${id}`);
    return "";
  }
  const section = document.createElement("section");
  section.className = type;
  section.innerHTML = `<h${format.level} id='${id}'>${format.prefix} ${object.data.title}</h${format.level}>
${marked.parse(object.content)}
<div>
${formatIndicators(object.data.indicators, format.level + 1)}
<div>
  ${object.data[format.contains]?.map(id => formatLevel(format.contains, id, document))?.join('')}
</div>
</div>
`;
  return section.outerHTML;
}

function setTitle(doc, title) {
  doc.querySelector("title").textContent = title;
  doc.querySelector("h1").textContent = title;
}

async function generateIndex() {
  const dom = await JSDOM.fromFile("_tools/framework-template.html");
  const document = dom.window.document;
  const mainEl = document.querySelector("main");
  const intro = JSDOM.fragment(`<p>This is the current draft of W3C Impact Framework based on approach anchored in the Theory of Change, applied to vision of the Web derived from the W3C Vision and the Ethical Web Principles.</p>
    <p>Each page describes an expected <dfn>Impact</dfn> that W3C seeks to see happen.</p>
    <p>Within these pages, <dfn>outcomes</dfn> are the pre-requisite needed to make the high-level impact statement true; <dfn>outputs</dfn> are the specific deliverable and changes W3C is well-positioned to carry forward; <dfn>activities</dfn> are the ways these outputs get produced within W3C, based on <dfn>inputs</dfn> W3C needs to ensure are and remain available.</p>
    <p>Any of those can be associated with <dfn>indicators</dfn> that help detect progress or regressions, and where additional focus and resources might be needed.</p>`);
  mainEl.parentElement.insertBefore(intro, mainEl);
  mainEl.innerHTML = `
<h2>Impact Statements</h2>
<ol>
${[...framework.get("impact-statements").entries().map(([id, statement]) => `<li><a href="${id}.html">${statement.data.statement}</a></li>`)].join('')}
</ol>
`;
  await writeFile("_site/index.html", dom.serialize(), "utf-8");
}

async function generateImpactPages() {
  const impacts = [...framework.get("impact-statements").values()];
  let counter = 0;
  for (const statement of impacts) {
    const dom = await JSDOM.fromFile("_tools/framework-template.html");
    const document = dom.window.document;
    setTitle(document, "Impact: " + statement.data.statement);
    const mainEl = document.querySelector("main");
    const nav = document.createElement("nav");
    nav.innerHTML = `
<a href="./" rel=up>Impact List</a> ${counter > 0 ? `<a href="${impacts[counter - 1].data.id}.html" rel=prev title="${impacts[counter - 1].data.title}">Previous Impact</a>`: "<span>Previous Impact</span>"} ${counter < impacts.length - 1 ? `<a href="${impacts[counter + 1].data.id}.html" rel=next title="${impacts[counter + 1].data.title}">Next Impact</a>`: "<span>Next Impact</span>"} 
`;
    mainEl.parentElement.insertBefore(nav, mainEl);
    mainEl.innerHTML = `
  <aside><abbr title="Ethical Web Principles">EWP</abbr>: ${statement.data.ewp.map(id => `<a href='https://www.w3.org/TR/ethical-web-principles/#${id}'>${ewp[id]}</a>`).join(', ')}</aside>
  ${statement.data.outcomes.map(id => formatLevel("outcomes", id, document))?.join('')}`;
    await writeFile(`_site/${statement.data.id}.html`, dom.serialize(), "utf-8");
    counter++;
  }
}

await generateIndex();
await generateImpactPages();
