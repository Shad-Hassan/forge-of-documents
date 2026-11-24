// Port of thread.py CSS (the f-string, transcribed with its interpolations kept as template slots).
import { FONT, HAIR, INK, NAVY, PAPER, SOFT } from "./tokens";

export const CSS = `
body{background:#FFFFFF;color:${INK};font-family:${FONT}}
.wrap{max-width:1000px;margin:0 auto;padding-block:28px 56px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.subj{margin:0 0 18px 52px;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-.01em;text-wrap:balance}
.msg{padding-block:18px 26px;border-top:1px solid ${HAIR}}
.msg:first-of-type{border-top:0;padding-top:4px}
.mh{display:grid;grid-template-columns:40px minmax(0,1fr) auto;column-gap:12px;align-items:start}
.av{width:40px;height:40px;border-radius:50%;background:${NAVY};color:#FFFFFF;display:grid;place-items:center;font-size:17px;font-weight:600;line-height:1}
.who{margin:0;font-size:14px;line-height:20px;overflow-wrap:anywhere}
.who b{font-weight:600}
.addr,.to,.when{font-size:12.5px;color:${SOFT}}
.to{margin:2px 0 0;line-height:18px}
.when{margin:0;line-height:20px;white-space:nowrap;font-variant-numeric:tabular-nums}
.mb{margin:14px 0 0 52px}
.shot{background:${PAPER};padding:24px 12px}
.shot img{display:block;width:100%;max-width:640px;height:auto;margin:0 auto;border:1px solid ${HAIR};border-radius:12px}
.bento{background:${PAPER};padding:22px}
.bx{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px}
.s2{grid-column:span 2}.s4{grid-column:span 4}.s6{grid-column:1/-1}
.bx-h{grid-column:1/-1;margin:2px 2px 6px;font-size:clamp(26px,3.4vw,38px);line-height:1.08;font-weight:700;letter-spacing:-.025em;text-wrap:balance;color:#161B20}
.bx-h3{grid-column:1/-1;margin:6px 2px -2px;font-size:22px;line-height:1.2;font-weight:700;letter-spacing:-.015em;color:#161B20}
.lead{grid-column:1/-1;margin:10px 2px 0;font-size:17px;line-height:1.55;color:#4A535B;max-width:62ch}
.t{position:relative;overflow:hidden;min-width:0;border-radius:22px;padding:24px;border:1px solid #DCE1E6;background:linear-gradient(165deg,#FFFFFF 0%,#F5F7F9 55%,#E9EDF1 100%);box-shadow:inset 0 1px 0 #FFFFFF,0 1px 2px rgba(22,27,32,.06),0 10px 28px rgba(22,27,32,.07)}
.t::before{content:"";position:absolute;left:0;right:0;top:0;height:55%;background:linear-gradient(180deg,rgba(255,255,255,.75),rgba(255,255,255,0));pointer-events:none}
.t>*{position:relative}
.hero{padding:32px 34px 30px;border-color:#22303D;color:#E9EDF0;background:linear-gradient(155deg,#22303D 0%,#121820 55%,#0A0B0D 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 14px 34px rgba(10,11,13,.22)}
.hero::before{background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,0))}
.qm{display:block;height:44px;font-family:'IBM Plex Serif',Georgia,serif;font-size:96px;line-height:.9;color:#5E7A96}
.yarn{margin:0;max-width:48ch;font-family:'IBM Plex Serif',Georgia,serif;font-style:italic;font-size:clamp(19px,2.1vw,24px);line-height:1.45;color:#E9EDF0}
.punch{margin:16px 0 0;max-width:44ch;font-size:clamp(17px,1.8vw,20px);line-height:1.4;font-weight:600;color:#9DB4CC}
.tagcard{transform:rotate(-1.2deg)}
.tagcard::after{content:"";position:absolute;top:16px;right:16px;width:14px;height:14px;border-radius:50%;border:2px solid #C3C9CF;background:${PAPER}}
.spec{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px 12px;margin:0}
.spec dt{padding-top:2px;font-size:12.5px;line-height:1.4;color:#7C868E}
.spec dd{margin:0;font-size:14.5px;line-height:1.4;font-weight:600;color:#161B20;overflow-wrap:anywhere}
.n{margin:0;font-family:'IBM Plex Sans Condensed','IBM Plex Sans',Helvetica,Arial,sans-serif;font-size:clamp(52px,6vw,76px);line-height:.9;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:#2E4A66;background:linear-gradient(180deg,#46698C 0%,#1F3348 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.l{margin:10px 0 0;font-size:14.5px;line-height:1.45;color:#4A535B}
.t>.ex{position:absolute;top:12px;right:18px;font-family:'IBM Plex Sans Condensed','IBM Plex Sans',Helvetica,Arial,sans-serif;font-size:44px;line-height:1;font-weight:700;color:#D3D8DD}
.pill{display:inline-block;max-width:calc(100% - 38px);padding:3px 13px;border-radius:999px;font-size:13px;font-weight:500;line-height:1.5;letter-spacing:.01em;color:#2E4A66;border:1px solid rgba(46,74,102,.35);background:linear-gradient(135deg,rgba(46,74,102,.12),rgba(46,74,102,.04))}
.q{margin:14px 0 0;font-size:18px;line-height:1.35;font-weight:600;letter-spacing:-.01em;color:#161B20}
.k{margin:10px 0 0;font-size:15px;line-height:1.55;color:#4A535B}
.hand h4{margin:0;font-size:20px;line-height:1.25;font-weight:700;letter-spacing:-.015em;color:#161B20}
.hand p{margin:10px 0 0;font-size:17px;line-height:1.55;color:#161B20;max-width:58ch}
.verdict{display:flex;flex-direction:column;justify-content:center;gap:14px;border-color:#8A3F31;color:#FFFFFF;background:linear-gradient(155deg,#C0695A 0%,#9A4A3A 45%,#6B2B20 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 14px 34px rgba(107,43,32,.25)}
.verdict::before{background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0))}
.bang{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#FFFFFF;color:#9A4A3A;font:700 18px/1 Arial,Helvetica,sans-serif}
.verdict p{margin:0;font-size:17px;line-height:1.5;font-weight:600}
@media (max-width:760px){
  .bx{grid-template-columns:minmax(0,1fr)}
  .s2,.s4,.s6{grid-column:1/-1}
  .bento{padding:16px}
  .hero{padding:26px 22px}
}
@media (max-width:600px){
  .subj{margin-left:0}
  .mh{grid-template-columns:40px minmax(0,1fr)}
  .when{grid-column:2;white-space:normal}
  .mb{margin-left:calc(-1*max(16px,env(safe-area-inset-left,0px)));margin-right:calc(-1*max(16px,env(safe-area-inset-right,0px)))}
}
`;
