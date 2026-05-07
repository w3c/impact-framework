import { readFileSync } from 'fs';
import { glob } from 'glob';
import matter from 'gray-matter';
import {JSDOM} from "jsdom";
import { marked } from "marked";

const framework = new Map();

const dom = await JSDOM.fromFile("_tools/framework-template.html");
const document = dom.window.document;
const mainEl = document.querySelector("main");

const ewp = JSON.parse(await readFileSync("_tools/ewp.json", 'utf-8'));

const files = (await glob('{impact-statements,outcomes,outputs,activities,inputs}/*.md')).sort();

for (const file of files) {

  let fileContent;
  try {
    fileContent = matter(readFileSync(file, 'utf8'));
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

function formatIndicators(id) {
}

function formatLevel(type, id) {
  const object = framework.get(type)?.get(id);
  const format = levelFormat[type];
  if (!object) {
    console.error(`Invalid ${type} id ${id}`);
    return "";
  }
  const section = document.createElement("section");
  section.innerHTML = `<h${format.level} id='${id}'>${format.prefix} ${object.data.title}</h${format.level}>
${marked.parse(object.content)}
  ${object.data[format.contains]?.map(id => formatLevel(format.contains, id))?.join('')}
`;
  return section.outerHTML;
}

for (const [id, statement] of framework.get("impact-statements").entries()) {
  const section = document.createElement("section");
  section.innerHTML = `<details><summary><h2 id='${id}'>${statement.data.statement}</h2></summary>
  <aside>Derived from Ethical Web Principles: ${statement.data.ewp.map(id => `<a href='https://www.w3.org/TR/ethical-web-principles/#${id}'>${ewp[id]}</a>`).join(', ')}</aside>
  ${statement.data.outcomes.map(id => formatLevel("outcomes", id))?.join('')}
  </details>
`;
  mainEl.append(section);
}

console.log(dom.serialize());
