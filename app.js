/* Public site configuration. Edit these values before deploying.
 * Do not put passwords or API keys in frontend JavaScript.
 */
'use strict';
const CONFIG = {
  builderName: 'OPEN / BUILD',
  githubUser: '', // REQUIRED: your GitHub username, e.g. 'octocat'
  githubSponsorsUrl: '', // Optional: https://github.com/sponsors/YOUR-USERNAME
  contactEmail: '' // Optional public email; not required
};

/* Replace these demo/concept entries with real repositories before public launch.
 * Add as many as you like. 'published: true' enables your repo/demo links.
 */
const projects = [
  {name:'OpenEventStudio', description:'Local-first desktop toolkit for live event preparation and production workflows (in development).',category:'Desktop Apps',stack:['Svelte','Tauri','Go'],byok:false,icon:'▣',published:false,repo:'',demo:''},
  {name:'RAG Model Bench',description:'A proposed way to compare embedding models, vector stores, and retrieval methods.',category:'AI Tools',stack:['Python','RAG','Embeddings'],byok:true,icon:'◇',published:false,repo:'',demo:''},
  {name:'Agent Workflow Lab',description:'Experimental agent coordination and repeatable automation workflows.',category:'AI Tools',stack:['Python','Agents'],byok:true,icon:'⌘',published:false,repo:'',demo:''},
  {name:'Device Diagnostics',description:'Command-line diagnostics for connected devices and networking workflows.',category:'CLI / Utilities',stack:['Linux','Python'],byok:false,icon:'>_',published:false,repo:'',demo:''}
];

const $ = id => document.getElementById(id);
const make = (tag, classname, content) => {
  const el=document.createElement(tag);
  if(classname) el.className=classname;
  if(content!==undefined) el.textContent=content;
  return el;
};
function externalLink(a,url){a.href=url;a.target='_blank';a.rel='noopener noreferrer';}
function safeURL(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!/(example\.com|your-username)/i.test(u.hostname+u.pathname)}catch{return false}}
function validUsername(name){return /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(name)&&!name.endsWith('-')}
function githubProfile(){return validUsername(CONFIG.githubUser)?`https://github.com/${CONFIG.githubUser}`:'https://github.com'}
function setupIdentity(){
  $('brand-name').textContent=CONFIG.builderName;
  const profile=githubProfile();
  externalLink($('header-github'),profile);
  externalLink($('bottom-github'),profile);
  $('current-year').textContent=new Date().getFullYear();
}
function projectCard(p){
  const card=make('article','project-card');
  const head=make('div','project-card-header');
  head.append(make('span','project-icon',p.icon),make('span','project-status',p.published?'PUBLIC RELEASE':'PLANNED / DEVELOPMENT'));
  card.append(head,make('h3','',p.name),make('p','project-description',p.description));
  const tags=make('div','tag-list');
  (p.stack||[]).forEach(s=>tags.append(make('span','stack-tag',s)));
  if(p.byok){let t=make('span','byok-tag','✧ BYOK');t.title='Bring Your Own Key';tags.append(t)}
  card.append(tags);
  const links=make('div','project-links');
  if(p.published&&safeURL(p.repo)){const a=make('a','','GitHub repo ↗');externalLink(a,p.repo);links.append(a)}
  else links.append(make('span','unavailable','Repo: not published'));
  if(p.published&&safeURL(p.demo)){const a=make('a','','Try / download ↗');externalLink(a,p.demo);links.append(a)}
  else links.append(make('span','unavailable','Demo: coming later'));
  card.append(links);return card;
}
function setupProjects(){
  const categories=['All',...new Set(projects.map(p=>p.category))],bar=$('filter-bar');let selected='All';
  const render=()=>{
    const shown=selected==='All'?projects:projects.filter(p=>p.category===selected);
    $('project-grid').replaceChildren(...shown.map(projectCard));
    $('project-count').textContent=String(shown.length).padStart(2,'0');
    [...bar.querySelectorAll('button')].forEach(b=>{const active=b.dataset.category===selected;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
    $('project-note').hidden=projects.every(p=>p.published);
  };
  categories.forEach(c=>{const b=make('button','filter-btn',c);b.type='button';b.dataset.category=c;b.onclick=()=>{selected=c;render()};bar.append(b)});
  render();
}
function setupSponsors(){
  const box=$('fiat-options');
  const sponsorUrl=validUsername(CONFIG.githubUser)?`https://github.com/sponsors/${CONFIG.githubUser}`:'';
  const url=safeURL(CONFIG.githubSponsorsUrl)?CONFIG.githubSponsorsUrl:sponsorUrl;
  const option=make('div','support-option');
  option.append(make('h4','','GitHub Sponsors'),make('p','','One-time or recurring sponsorship, when enabled for this GitHub account. Payments and billing stay with GitHub.'));
  const link=make('a','',url?'Visit GitHub Sponsors ↗':'Set your GitHub username to enable this link');
  if(url) externalLink(link,url); else {link.removeAttribute('href');link.className='not-configured'}
  option.append(link);box.append(option);
  if(!validUsername(CONFIG.githubUser)){
    const notice=make('p','panel-footnote','Setup required: edit githubUser in app.js. The support link cannot be used until GitHub Sponsors has approved and activated your profile.');
    box.append(notice);
  }
}
setupIdentity();setupProjects();setupSponsors();
