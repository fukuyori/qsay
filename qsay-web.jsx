import { useState, useCallback, useRef, useEffect } from "react";

// ═══════════════════════════════════════════════════════
//  DETECTION ENGINE — 38 rules
// ═══════════════════════════════════════════════════════

const INTRO_TEMPLATES = [
  "この記事では","本記事では","今回は","ここでは","以下では",
  "について解説","について紹介","について説明","をご紹介","を解説し",
  "を紹介し","を説明し","についてまとめ","について詳しく",
];
const OUTRO_TEMPLATES = [
  "いかがでしたか","いかがでしょうか","まとめると","以上が",
  "ぜひ参考にしてください","参考になれば幸いです","お役に立てれば",
  "最後までお読みいただき","以上をまとめると","これらを踏まえて",
  "ぜひ試してみてください","ぜひ活用してみてください","ぜひお試しください",
];
const GENERIC_CONNECTORS = [
  "しかし","一方で","また","さらに","加えて","その上","したがって",
  "そのため","つまり","具体的には","例えば","特に","重要なのは",
  "注目すべきは","結論として","一般的に","基本的に","実際に",
  "まず","次に","最後に","そして","ある意味で","いわば","おそらく",
];
const ABSTRACT_NOUNS = [
  "観点","側面","要素","概念","重要性","可能性","必要性","多様性",
  "柔軟性","効率性","生産性","有効性","信頼性","持続可能性",
  "アプローチ","プロセス","フレームワーク","メソッド","パラダイム",
  "コンテキスト","インサイト","ソリューション","パフォーマンス",
  "ポテンシャル","メリット","デメリット","トレードオフ",
  "取り組み","仕組み","在り方","あり方","意義","本質","背景","課題",
];
const THOUGHT_TRACES = [
  "だろうか","かもしれない","かもしれません","気がする","気がした",
  "気もする","どうだろう","わからない","わかりません","迷う","悩む",
  "というか","いや、","いや，","っていうか","というより","正確には",
  "厳密には","正直","ぶっちゃけ","実感","肌感覚","個人的に",
  "自分としては","なんだか","なんとなく","ふと","そういえば",
  "まあ","やっぱり","やはり","——","――","…","……",
];
const DEMONSTRATIVES = [
  "これ","それ","あれ","この","その","あの","ここ","そこ",
  "こう","そう","ああ","こんな","そんな","あんな","こちら","そちら",
];
const KATAKANA_BUZZWORDS = [
  "アプローチ","ソリューション","イノベーション","パフォーマンス",
  "コンテキスト","フレームワーク","メソッド","パラダイム","インサイト",
  "ポテンシャル","オプティマイズ","オプティマイゼーション","スキーム",
  "コンセンサス","エビデンス","リテラシー","ガバナンス","コンプライアンス",
  "ダイバーシティ","サステナビリティ","レジリエンス","スケーラビリティ",
  "アジェンダ","マイルストーン","ステークホルダー","ロードマップ",
  "フィードバック","ブレークスルー","エンゲージメント","エコシステム",
  "シナジー","ベンチマーク","プライオリティ","トレードオフ",
  "ボトルネック","マネタイズ","インプリメント","アウトプット",
  "インプット","アジャイル",
];
const ENUM_MARKERS = [
  "第一に","第二に","第三に","第四に","第五に","1つ目","2つ目","3つ目",
  "4つ目","5つ目","一つ目","二つ目","三つ目","四つ目","五つ目",
  "まず第一に","次に第二に","1点目","2点目","3点目","4点目",
];
const NOM_PATTERNS = [
  /を行[うっいえ]/g, /を実施す/g, /を実行す/g, /を推進す/g, /を遂行す/g,
  /を展開す/g, /を図[るっ]/g, /を進め/g, /の実現を/g, /の向上を/g,
  /の強化を/g, /の改善を/g, /の促進を/g, /の確保を/g, /の構築を/g,
  /の策定を/g, /の整備を/g,
];
const VERBOSE_FILLERS = [
  "することが可能です","することができます","することが重要です",
  "することが必要です","することが求められ","することが不可欠",
  "することが期待され","という点が挙げられ","という側面があ",
  "という観点から","という結論に至","ということが言え",
  "と言えるでしょう","と考えられます","と考えられています",
  "において重要な役割","に寄与する","に資する","に貢献する",
  "を踏まえた上で","を念頭に置",
];
const EMPHASIS_ADVERBS = [
  "極めて","非常に","大変","きわめて","著しく","甚だ","格段に",
  "圧倒的に","飛躍的に","劇的に","画期的に","抜本的に","顕著に",
];
const HEDGING_EXPRS = [
  "と考えられる","と思われる","と言えるだろう","と言えよう",
  "と推察される","と推測される","と見られる","と見なされる",
  "ではないだろうか","ではないかと","可能性がある",
  "傾向がある","傾向にある","懸念される","期待される",
];
const PERSON_1ST = ["私たち","我々","弊社","当社","筆者","著者","本稿","私"];
const PERSON_2ND = ["あなた","皆様","皆さん","貴社","御社","読者"];

function splitSentences(t) { return t.split(/(?<=[。！？!?])\s*/).map(s=>s.trim()).filter(Boolean); }
function splitParagraphs(t) { return t.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean); }
function countChars(t) { return t.replace(/\s/g,"").length; }
function isKanji(ch) { const c=ch.codePointAt(0); return (c>=0x4E00&&c<=0x9FFF)||(c>=0x3400&&c<=0x4DBF); }
function cntMatch(t,s) { let c=0,i=0; while((i=t.indexOf(s,i))!==-1){c++;i+=s.length;} return c; }

function runDetection(text) {
  const findings = [];
  const lines = text.split("\n");
  const sentences = splitSentences(text);
  const paragraphs = splitParagraphs(text);
  const totalChars = countChars(text);

  // ── VISUAL RULES ──

  // DR-16
  { const lp=/^\s*(?:[-\-•*・]|\d+[.．)）])\s+/; const ep=/^\s*[\u{1F300}-\u{1FAFF}\u2300-\u23FF\u2600-\u27BF]/u;
    let c=0; for(let i=1;i<lines.length;i++){const p=lines[i-1].trim(),cu=lines[i].trim();if((lp.test(cu)||ep.test(cu))&&/[：:]$/.test(p))c++;}
    findings.push({id:"DR-16",name:"箇条書き直前が「：」",count:c,score:Math.min(1,c*0.45),cat:"visual"}); }

  // DR-17
  { const ep=/^\s*[\u{1F300}-\u{1FAFF}\u2300-\u23FF\u2600-\u27BF\u2B50-\u2BFF]/u;
    let c=0; for(const l of lines)if(ep.test(l.trim()))c++;
    findings.push({id:"DR-17",name:"箇条書きに絵文字を使用",count:c,score:c>0?Math.min(1,0.3+c*0.15):0,cat:"visual"}); }

  // DR-18 isolated quotes
  { let c=0; for(const l of lines){const s=l.trim();if(/^「[^」]+」$/.test(s))c++;}
    findings.push({id:"DR-18",name:"「」が単独行の引用",count:c,score:c>0?Math.min(1,c*0.35):0,cat:"visual"}); }

  // DR-20
  { const pats=["以下の","以下に","以下では","以下のような","以下の通り","以下をご覧"];
    let c=0; for(const p of pats)c+=cntMatch(text,p);
    findings.push({id:"DR-20",name:"「以下の〜」の過剰使用",count:c,score:Math.min(1,Math.max(0,(c-1)*0.35)),cat:"visual"}); }

  // DR-21 list item count bias
  { const lp=/^\s*(?:[-\-•*・]|\d+[.．)）])\s+/; const ep=/^\s*[\u{1F300}-\u{1FAFF}\u2300-\u23FF\u2600-\u27BF]/u;
    let blocks=[],cur=[]; for(const l of lines){const s=l.trim();if(lp.test(s)||ep.test(s)){cur.push(s)}else{if(cur.length)blocks.push(cur);cur=[];}}
    if(cur.length)blocks.push(cur); let bias=0;for(const b of blocks)if(b.length>=3&&b.length<=5)bias++;
    const sc=blocks.length>0&&bias/blocks.length>=0.5?Math.min(1,0.3+bias*0.15):0;
    findings.push({id:"DR-21",name:"箇条書き項目数が3〜5に偏り",count:bias,score:sc,cat:"visual"}); }

  // DR-22 list ending uniformity
  { const lp=/^\s*(?:[-\-•*・]|\d+[.．)）]|[\u{1F300}-\u{1FAFF}])\s*/u;
    let blocks=[],cur=[]; for(const l of lines){const s=l.trim();if(lp.test(s)){cur.push(s)}else{if(cur.length>=3)blocks.push(cur);cur=[];}}
    if(cur.length>=3)blocks.push(cur); let hitBlocks=0,locs=[];
    for(const b of blocks){const ends=b.map(i=>{const m=i.match(/.$/);return m?m[0]:""});
      if(ends.length>=3&&new Set(ends).size===1){hitBlocks++;locs.push({items:b,ending:ends[0]});}}
    findings.push({id:"DR-22",name:"箇条書き文末の完全一致",count:hitBlocks,score:hitBlocks>0?Math.min(1,0.3+hitBlocks*0.25):0,cat:"visual",locations:locs}); }

  // DR-23 bold textbook
  { const bolds=(text.match(/\*\*[^*]+\*\*/g)||[]); const c=bolds.length;
    const pw=new Set(); paragraphs.forEach((p,i)=>{if(/\*\*[^*]+\*\*/.test(p))pw.add(i)});
    const r=paragraphs.length>0?pw.size/paragraphs.length:0;
    findings.push({id:"DR-23",name:"太字強調の教科書的使用",count:c,score:c>=3?Math.min(1,r*0.8):0,cat:"visual"}); }

  // DR-24 paragraph uniformity
  { if(paragraphs.length>=3){const ls=paragraphs.map(p=>p.length);const m=ls.reduce((a,b)=>a+b,0)/ls.length;
    const s=Math.sqrt(ls.reduce((a,b)=>a+(b-m)**2,0)/ls.length);const cv=m>0?s/m:1;
    findings.push({id:"DR-24",name:"段落構造が均一すぎる",count:paragraphs.length,score:cv<0.3?0.7:cv<0.5?0.3:cv<0.7?0.1:0,cat:"visual",detail:`CV: ${cv.toFixed(2)}`});
  } else findings.push({id:"DR-24",name:"段落構造が均一すぎる",count:0,score:0,cat:"visual"}); }

  // DR-25 intro+outro
  { let intro=0,outro=0; for(const t of INTRO_TEMPLATES)if(text.includes(t))intro++;
    for(const t of OUTRO_TEMPLATES)if(text.includes(t))outro++;
    const sc=(intro>0&&outro>0)?Math.min(1,0.4+(intro+outro-2)*0.15):Math.max(intro,outro)>1?0.2:0;
    findings.push({id:"DR-25",name:"導入テンプレ＋結語テンプレ",count:intro+outro,score:sc,cat:"visual"}); }

  // DR-26 heading uniformity
  { const hs=lines.filter(l=>/^#{1,4}\s/.test(l.trim())); if(hs.length>=3){
    const lens=hs.map(h=>h.replace(/^#+\s*/,"").length);const m=lens.reduce((a,b)=>a+b,0)/lens.length;
    const s=Math.sqrt(lens.reduce((a,b)=>a+(b-m)**2,0)/lens.length);const cv=m>0?s/m:1;
    findings.push({id:"DR-26",name:"見出し構造の均一性",count:hs.length,score:cv<0.2?0.6:cv<0.35?0.3:0,cat:"visual"});
  } else findings.push({id:"DR-26",name:"見出し構造の均一性",count:0,score:0,cat:"visual"}); }

  // DR-27 parenthetical overuse
  { let c=0; for(const s of sentences)c+=(s.match(/（[^）]+）/g)||[]).length;
    const d=sentences.length>0?c/sentences.length:0;
    findings.push({id:"DR-27",name:"括弧内注釈の多用",count:c,score:d>0.5?0.6:d>0.3?0.3:d>0.15?0.1:0,cat:"visual"}); }

  // DR-28 definition repetition
  { let c=0; for(const s of sentences)if(/とは[、，]/.test(s)||/とは[^\u3000-\u303F]/.test(s))c++;
    findings.push({id:"DR-28",name:"「〜とは」定義反復",count:c,score:c>=3?0.7:c>=2?0.4:0,cat:"visual"}); }

  // DR-29 list+summary
  { const lp=/^\s*(?:[-\-•*・]|\d+[.．)）]|[\u{1F300}-\u{1FAFF}])\s+/u;
    let listZones=[],inList=false,start=0;
    lines.forEach((l,i)=>{if(lp.test(l.trim())){if(!inList){start=i;inList=true}}else{if(inList){listZones.push([start,i-1]);inList=false;}}});
    if(inList)listZones.push([start,lines.length-1]);
    let c=0; for(const[s,e]of listZones){const after=lines.slice(e+1,e+4).join("");
      if(after.includes("まとめると")||after.includes("以上")||after.includes("これら"))c++;}
    findings.push({id:"DR-29",name:"箇条書き＋要約反復",count:c,score:c>0?Math.min(1,0.3+c*0.2):0,cat:"visual"}); }

  // ── STRUCTURAL RULES ──

  // DR-04 connectors
  { let h=0; for(const s of sentences)if(GENERIC_CONNECTORS.some(c=>s.includes(c)))h++;
    const d=sentences.length>0?h/sentences.length:0;
    findings.push({id:"DR-04",name:"定型接続語の高密度使用",count:h,score:Math.min(1,Math.max(0,(d-0.15)/0.35)),cat:"structural",detail:`密度: ${(d*100).toFixed(0)}%`}); }

  // DR-05 sentence ending
  { if(sentences.length>=3){const ends=sentences.map(s=>{const m=s.match(/(.{1,4})[。！？!?]?$/);return m?m[1]:s.slice(-2)});
    const u=new Set(ends).size; const dv=u/ends.length;
    findings.push({id:"DR-05",name:"文末表現の単調さ",count:sentences.length,score:dv<0.2?0.8:dv<0.3?0.5:dv<0.5?0.2:0,cat:"structural",detail:`多様性: ${dv.toFixed(2)}`});
  } else findings.push({id:"DR-05",name:"文末表現の単調さ",count:0,score:0,cat:"structural"}); }

  // DR-02 sentence length
  { if(sentences.length>=4){const ls=sentences.map(s=>s.length);const m=ls.reduce((a,b)=>a+b,0)/ls.length;
    const s=Math.sqrt(ls.reduce((a,b)=>a+(b-m)**2,0)/ls.length);const cv=m>0?s/m:1;
    findings.push({id:"DR-02",name:"文長の均一性",count:sentences.length,score:cv<0.2?0.8:cv<0.35?0.4:cv<0.5?0.15:0,cat:"structural",detail:`CV: ${cv.toFixed(2)}`});
  } else findings.push({id:"DR-02",name:"文長の均一性",count:0,score:0,cat:"structural"}); }

  // DR-07 abstract nouns
  { let h=0; const hw={}; for(const s of sentences){let f=false;for(const n of ABSTRACT_NOUNS)if(s.includes(n)){f=true;hw[n]=(hw[n]||0)+1;}if(f)h++;}
    const d=sentences.length>0?h/sentences.length:0; const sc=Math.min(1,Math.max(0,(d-0.15)/0.35));
    const top=Object.entries(hw).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([w,c])=>`${w}(${c})`).join(", ");
    findings.push({id:"DR-07",name:"抽象名詞の高密度使用",count:h,score:sc,cat:"structural",detail:top?`頻出: ${top}`:""}); }

  // DR-09 thought traces
  { if(sentences.length>=5){let tc=0;const fd=[];for(const t of THOUGHT_TRACES)if(text.includes(t)){tc++;fd.push(t);}
    const r=tc/sentences.length; const sc=tc===0?0.9:r<0.05?0.7:r<0.1?0.4:r<0.2?0.2:0;
    findings.push({id:"DR-09",name:"思考の痕跡の欠如",count:tc,score:sc,cat:"structural",detail:fd.length>0?`検出: ${fd.slice(0,5).join(", ")}`:"痕跡表現なし"});
  } else findings.push({id:"DR-09",name:"思考の痕跡の欠如",count:0,score:0,cat:"structural"}); }

  // DR-10 passive
  { const pats=[/れている/g,/られている/g,/されて/g,/れた結果/g,/られます/g,/されます/g,/される/g,/れる。/g];
    let c=0; for(const p of pats)c+=(text.match(p)||[]).length; const d=sentences.length>0?c/sentences.length:0;
    findings.push({id:"DR-10",name:"受身表現の偏り",count:c,score:d>0.5?0.7:d>0.35?0.4:d>0.2?0.2:0,cat:"structural"}); }

  // DR-11 demonstratives
  { if(sentences.length>=5){let ds=0;for(const s of sentences)if(DEMONSTRATIVES.some(d=>s.includes(d)))ds++;
    const r=ds/sentences.length;
    findings.push({id:"DR-11",name:"指示語の不自然な少なさ",count:ds,score:r<0.05?0.8:r<0.1?0.5:r<0.2?0.25:0,cat:"structural",detail:`含有率: ${(r*100).toFixed(0)}%`});
  } else findings.push({id:"DR-11",name:"指示語の不自然な少なさ",count:0,score:0,cat:"structural"}); }

  // DR-12 kanji ratio
  { let kc=0,cc=0; for(const ch of text){if(/[\p{L}\p{N}]/u.test(ch)){cc++;if(isKanji(ch))kc++;}}
    const r=cc>50?kc/cc:0;
    findings.push({id:"DR-12",name:"漢語率の異常な高さ",count:kc,score:r>0.50?0.9:r>0.45?0.6:r>0.40?0.3:r>0.35?0.1:0,cat:"structural",detail:cc>0?`${kc}/${cc} (${(r*100).toFixed(0)}%)`:""});}

  // DR-34 katakana buzzwords
  { if(sentences.length>=3){let hc=0;const hw={};for(const b of KATAKANA_BUZZWORDS){const c=cntMatch(text,b);if(c>0){hc+=c;hw[b]=c;}}
    const d=hc/sentences.length; const sc=d>1.5?0.9:d>1.0?0.7:d>0.5?0.4:d>0.3?0.15:0;
    const top=Object.entries(hw).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([w,c])=>`${w}(${c})`).join(", ");
    findings.push({id:"DR-34",name:"カタカナ語の集中",count:hc,score:sc,cat:"structural",detail:top?`密度: ${d.toFixed(2)}/文, ${top}`:""});
  } else findings.push({id:"DR-34",name:"カタカナ語の集中",count:0,score:0,cat:"structural"}); }

  // DR-35 enumeration markers
  { const fd=[]; for(const m of ENUM_MARKERS)if(text.includes(m))fd.push(m); const c=fd.length;
    findings.push({id:"DR-35",name:"列挙マーカーの機械的使用",count:c,score:c>=4?0.9:c>=3?0.7:c>=2?0.4:0,cat:"structural",detail:fd.length?`検出: ${fd.join(", ")}`:""}); }

  // DR-36 sentence opening monotony
  { if(sentences.length>=5){const ops=sentences.map(s=>{const m=s.trim().match(/^(.{1,8}?)[、，,\s]/);return m?m[1]:s.trim().slice(0,4);});
    const freq={};for(const o of ops)freq[o]=(freq[o]||0)+1;
    const [tw,tc]=Object.entries(freq).sort((a,b)=>b[1]-a[1])[0]||["",0]; const rr=tc/sentences.length;
    const reps=Object.fromEntries(Object.entries(freq).filter(([,v])=>v>=2)); const trr=Object.values(reps).reduce((a,b)=>a+b,0)/sentences.length;
    const sc=rr>=0.5?0.9:rr>=0.35?0.6:trr>=0.5?0.4:trr>=0.3?0.2:0;
    const topI=Object.entries(reps).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([w,c])=>`「${w}」(${c}回)`).join(", ");
    findings.push({id:"DR-36",name:"文頭パターンの反復",count:Object.values(reps).reduce((a,b)=>a+b,0),score:sc,cat:"structural",detail:topI?`反復: ${topI}`:""});
  } else findings.push({id:"DR-36",name:"文頭パターンの反復",count:0,score:0,cat:"structural"}); }

  // DR-37 nominalization
  { let c=0;const ms=[]; for(const p of NOM_PATTERNS){const f=text.match(p);if(f){c+=f.length;ms.push(...f.slice(0,2));}}
    const d=sentences.length?c/sentences.length:0;
    findings.push({id:"DR-37",name:"名詞化冗長表現",count:c,score:d>0.8?0.9:d>0.5?0.6:d>0.3?0.35:d>0.15?0.15:0,cat:"structural",detail:ms.length?`密度: ${d.toFixed(2)}/文, 例: ${ms.slice(0,4).join("、")}`:""}); }

  // DR-38 verbose fillers
  { let c=0;const hp=[]; for(const f of VERBOSE_FILLERS){const n=cntMatch(text,f);if(n>0){c+=n;hp.push(f);}}
    const d=sentences.length?c/sentences.length:0;
    findings.push({id:"DR-38",name:"冗長定型句",count:c,score:d>0.6?0.8:d>0.4?0.55:d>0.25?0.3:d>0.1?0.1:0,cat:"structural",detail:hp.length?`密度: ${d.toFixed(2)}/文, ${hp.slice(0,4).join("、")}`:""}); }

  // ── NEW RULES v0.3.0 ──

  // DR-39 style mixing (です/ます vs だ/である)
  { if(sentences.length>=4){
    const desuPat=/(?:です|ます|でした|ました|ません|でしょう|ください)[。！？!?\s]*$/;
    const daPat=/(?:である|であった|だろう|ではない)[。！？!?\s]*$/;
    const daEnd=/(?<![いきしちにひみりぎじびぴえけせてねへめれげぜべぺおこそとのほもよろごぞどのぼぽんっ])だ[。！？!?\s]*$/;
    let dm=0,da=0;
    for(const s of sentences){if(desuPat.test(s))dm++;else if(daPat.test(s)||daEnd.test(s))da++;}
    const total=dm+da; const minority=Math.min(dm,da);
    const ratio=total>0?minority/total:0;
    const sc=minority>0?(ratio>0.3?0.9:ratio>0.2?0.6:ratio>0.1?0.3:0.15):0;
    const maj=dm>=da?"です/ます":"だ/である";
    findings.push({id:"DR-39",name:"文体混在",count:minority,score:sc,cat:"structural",
      detail:total>0?`です/ます: ${dm}文, だ/である: ${da}文 → 多数派: ${maj}`:""});
  } else findings.push({id:"DR-39",name:"文体混在",count:0,score:0,cat:"structural"}); }

  // DR-40 hedging expression overuse
  { let c=0;const fd=[];for(const h of HEDGING_EXPRS){const n=cntMatch(text,h);if(n>0){c+=n;fd.push(h);}}
    const d=sentences.length?c/sentences.length:0;
    findings.push({id:"DR-40",name:"思考保留表現の多用",count:c,score:d>0.5?0.8:d>0.3?0.5:d>0.15?0.25:d>0.05?0.1:0,cat:"structural",
      detail:fd.length?`密度: ${d.toFixed(2)}/文, ${fd.slice(0,4).join("、")}`:""}); }

  // DR-41 emphasis adverb overuse
  { let c=0;const fd=[];for(const e of EMPHASIS_ADVERBS){const n=cntMatch(text,e);if(n>0){c+=n;fd.push(`${e}(${n})`);}}
    findings.push({id:"DR-41",name:"強調語の過密",count:c,score:c>=6?0.9:c>=4?0.6:c>=3?0.35:c>=2?0.15:0,cat:"structural",
      detail:fd.length?`${fd.slice(0,5).join(", ")}`:""}); }

  // DR-42 person/viewpoint mixing
  { const f1=[],f2=[];
    for(const p of PERSON_1ST)if(text.includes(p))f1.push(p);
    for(const p of PERSON_2ND)if(text.includes(p))f2.push(p);
    const mixed=f1.length>0&&f2.length>0;
    findings.push({id:"DR-42",name:"視点（人称）の混在",count:f1.length+f2.length,score:mixed?0.7:0,cat:"structural",
      detail:mixed?`1人称: ${f1.join("、")} / 2人称: ${f2.join("、")}`:""}); }

  // DR-43 fullwidth/halfwidth mixing
  { const fw=(text.match(/[\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A]/g)||[]).length;
    const hw=(text.match(/[0-9A-Za-z]/g)||[]).length;
    const mixed=fw>0&&hw>0;
    findings.push({id:"DR-43",name:"全角半角混在",count:fw,score:mixed?(fw>5?0.8:fw>2?0.5:0.25):0,cat:"visual",
      detail:mixed?`全角: ${fw}文字, 半角: ${hw}文字`:""}); }

  // DR-44 number notation inconsistency
  { const arabic=[]; const kanji=[];
    const arRe=/([0-9０-９]+)\s*(?:つ|個|件|本|人|回|年|月|日|時|分|秒|円|万|億)/g;
    const knRe=/([一二三四五六七八九十百千]+)\s*(?:つ|個|件|本|人|回|年|月|日|時|分|秒|円|万|億)/g;
    let m; while((m=arRe.exec(text))!==null)arabic.push(m[0]);
    while((m=knRe.exec(text))!==null)kanji.push(m[0]);
    const mixed=arabic.length>0&&kanji.length>0;
    findings.push({id:"DR-44",name:"数字表記の揺れ",count:arabic.length+kanji.length,score:mixed?(Math.min(arabic.length,kanji.length)>2?0.7:0.4):0,cat:"visual",
      detail:mixed?`算用: ${arabic.slice(0,3).join("、")} / 漢数字: ${kanji.slice(0,3).join("、")}`:""}); }

  // DR-45 symbol mixing
  { let issues=[];
    const tilde=(text.match(/～/g)||[]).length; const wave=(text.match(/〜/g)||[]).length;
    if(tilde>0&&wave>0)issues.push(`～/〜混在(${tilde}/${wave})`);
    else if(tilde>0)issues.push(`～→〜(${tilde})`);
    const dots=(text.match(/\.{3,}|．{3,}/g)||[]).length; const ellipsis=(text.match(/…/g)||[]).length;
    if(dots>0&&ellipsis>0)issues.push(`...と…混在(${dots}/${ellipsis})`);
    else if(dots>0)issues.push(`...→…(${dots})`);
    const sc=issues.length>1?0.6:issues.length>0?0.3:0;
    findings.push({id:"DR-45",name:"記号混在",count:tilde+dots,score:sc,cat:"visual",detail:issues.join(", ")}); }

  // DR-46 rhetorical question + assertion proximity
  { let c=0;
    for(let i=0;i<sentences.length-1;i++){
      const q=sentences[i]; const a=sentences[i+1];
      if(/[？?]\s*$/.test(q)){
        if(/(?:は明[白ら]|は自明|は当然|は言うまでもない|ことは明らか|は間違いない|は疑いない|に他ならない|のである)[。！？!?]?\s*$/.test(a))c++;
        else if(/(?:である|です|だ|ある)[。]\s*$/.test(a)&&!/(?:か|だろう|でしょう)[。？?]?\s*$/.test(a))c++;
      }
    }
    findings.push({id:"DR-46",name:"疑問＋断定の近接",count:c,score:c>=3?0.8:c>=2?0.5:c>=1?0.25:0,cat:"structural",detail:c>0?`${c}箇所`:""}); }

  // ── SCORING ──
  const vW={"DR-16":0.25,"DR-17":0.25,"DR-18":0.05,"DR-20":0.12,"DR-21":0.08,"DR-22":0.05,"DR-23":0.10,"DR-24":0.08,"DR-25":0.10,"DR-26":0.03,"DR-27":0.03,"DR-28":0.03,"DR-29":0.05,"DR-43":0.08,"DR-44":0.05,"DR-45":0.05};
  const sW={"DR-04":0.10,"DR-05":0.10,"DR-02":0.06,"DR-07":0.12,"DR-09":0.15,"DR-10":0.05,"DR-11":0.12,"DR-12":0.05,"DR-34":0.12,"DR-35":0.10,"DR-36":0.12,"DR-37":0.10,"DR-38":0.10,"DR-39":0.12,"DR-40":0.08,"DR-41":0.08,"DR-42":0.08,"DR-46":0.06};
  let vs=0,vt=0,ss=0,st=0;
  for(const f of findings){if(f.cat==="visual"&&vW[f.id]){vs+=f.score*vW[f.id];vt+=vW[f.id];}if(f.cat==="structural"&&sW[f.id]){ss+=f.score*sW[f.id];st+=sW[f.id];}}

  return {
    findings: findings.filter(f=>f.score>0).sort((a,b)=>b.score-a.score),
    allFindings: findings,
    visualScore: vt>0?Math.min(1,vs/vt):0,
    structuralScore: st>0?Math.min(1,ss/st):0,
    stats: { chars:totalChars, paragraphs:paragraphs.length, sentences:sentences.length },
  };
}

// ═══════════════════════════════════════════════════════
//  REVISION ENGINE — 11 auto-fix rules + 3-layer control
// ═══════════════════════════════════════════════════════

function reviseColonBeforeList(text, limit) {
  const re = /([：:])\s*\n(\s*(?:[-\-•*・]|\d+[.．)）]|[\u{1F300}-\u{1FAFF}\u2300-\u23FF\u2600-\u27BF]))/gu;
  const recs = []; let c = 0;
  const revised = text.replace(re, (m, p1, p2) => {
    if (c >= limit) return m; c++;
    recs.push({ id: "RV-16", desc: "「：」→「。」", before: m.replace(/\n/g,"↵").slice(0,25), after: "。↵" + p2.trim().slice(0,15) });
    return "。\n" + p2;
  });
  return [revised, recs];
}

function reviseEmojiBullet(text, limit) {
  const re = /^(\s*)([\u{1F300}-\u{1FAFF}\u2300-\u23FF\u2600-\u27BF\u2B50-\u2BFF][\uFE00-\uFE0F\u200D]*)\s*/gmu;
  const recs = []; let c = 0;
  const revised = text.replace(re, (m, indent, emoji) => {
    if (c >= limit) return m; c++;
    recs.push({ id: "RV-17", desc: "絵文字を削除", before: m.trim().slice(0,20), after: "- " });
    return indent + "- ";
  });
  return [revised, recs];
}

function reviseFollowingPhrase(text, limit) {
  const recs = []; const occ = []; let idx = 0;
  while ((idx = text.indexOf("以下の", idx)) !== -1) { occ.push(idx); idx += 3; }
  if (occ.length <= 1) return [text, recs];
  let revised = text;
  const toRemove = occ.slice(1).reverse().slice(0, limit);
  for (const i of toRemove) {
    const before = revised.slice(Math.max(0, i - 5), i + 8);
    revised = revised.slice(0, i) + revised.slice(i + 3);
    recs.push({ id: "RV-20", desc: "「以下の」を削除", before: before.slice(0,25), after: revised.slice(Math.max(0,i-5),i+5).slice(0,25) });
  }
  return [revised, recs];
}

function reviseBoldTextbook(text, limit) {
  const recs = []; const re = /\*\*([^*]+)\*\*/g; const ms = [];
  let m; while ((m = re.exec(text)) !== null) ms.push(m);
  if (ms.length < 3) return [text, recs];
  const toRemove = []; for (let i = 2; i < ms.length; i += 2) toRemove.push(ms[i]);
  let revised = text;
  for (const mt of toRemove.reverse().slice(0, limit)) {
    const inner = mt[1];
    revised = revised.slice(0, mt.index) + inner + revised.slice(mt.index + mt[0].length);
    recs.push({ id: "RV-23", desc: "太字を解除", before: `**${inner.slice(0,12)}**`, after: inner.slice(0,15) });
  }
  return [revised, recs];
}

function reviseIsolatedQuote(text, limit) {
  const recs = []; const lines = text.split("\n"); const out = []; let applied = 0;
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i].trim();
    if (applied >= limit || !/^「[^」]+」$/.test(s)) { out.push(lines[i]); continue; }
    let ni = i + 1; while (ni < lines.length && !lines[ni].trim()) ni++;
    if (ni < lines.length && lines[ni].trim() && !lines[ni].trim().startsWith("#")) {
      const merged = s + lines[ni].trimStart();
      recs.push({ id: "RV-18", desc: "引用を次行と結合", before: s.slice(0,25), after: merged.slice(0,30) });
      out.push(merged); i = ni; applied++;
    } else { out.push(lines[i]); }
  }
  return [out.join("\n"), recs];
}

function reviseListEnding(text, finding, limit) {
  const recs = []; if (!finding.locations || !finding.locations.length) return [text, recs];
  const lines = text.split("\n"); let applied = 0;
  for (const loc of finding.locations) {
    if (applied >= limit) break;
    const items = loc.items || []; if (!items.length) continue;
    const target = items[items.length - 1];
    for (let i = 0; i < lines.length; i++) {
      const s = lines[i].trim();
      if (s.startsWith(target.slice(0, 15))) {
        const old = lines[i];
        if (s.endsWith("る")) lines[i] = lines[i].trimEnd() + "ことがある";
        else if (s.endsWith("す")) lines[i] = lines[i].trimEnd() + "こともある";
        else if (s.endsWith("い")) lines[i] = lines[i].trimEnd() + "かもしれない";
        else lines[i] = lines[i].trimEnd() + "など";
        recs.push({ id: "RV-22", desc: "文末を変更", before: old.trim().slice(-20), after: lines[i].trim().slice(-20) });
        applied++; break;
      }
    }
  }
  return [lines.join("\n"), recs];
}

const REVISION_ORDER = ["DR-16","DR-18","DR-20","DR-22","DR-23","DR-27","DR-41"];
const REVISION_FNS = {
  "DR-16": (t, f, l) => reviseColonBeforeList(t, l),
  "DR-18": (t, f, l) => reviseIsolatedQuote(t, l),
  "DR-20": (t, f, l) => reviseFollowingPhrase(t, l),
  "DR-22": (t, f, l) => reviseListEnding(t, f, l),
  "DR-23": (t, f, l) => reviseBoldTextbook(t, l),
  "DR-27": (t, f, l) => reviseParenthetical(t, l),
  "DR-41": (t, f, l) => reviseEmphasisOveruse(t, l),
};
const PER_RULE_CAP = {"DR-16":2,"DR-18":2,"DR-20":2,"DR-22":1,"DR-23":3,"DR-27":2,"DR-41":3};

// ── DR-27 auto-fix: remove parentheses from 3rd+ occurrence ──
function reviseParenthetical(text, limit) {
  const ms=[...text.matchAll(/（([^）]+)）/g)];
  if(ms.length<3)return[text,[]];
  const recs=[]; let revised=text;
  const toRemove=ms.slice(2).reverse().slice(0,limit);
  for(const m of toRemove){
    revised=revised.slice(0,m.index)+m[1]+revised.slice(m.index+m[0].length);
    recs.push({id:"RV-27",desc:"括弧を外す",before:m[0].slice(0,20),after:m[1].slice(0,20)});
  }
  return[revised,recs];
}

// ── DR-39 auto-fix: unify style (desu/masu ↔ da/dearu) ──
function reviseStyleMixing(text) {
  const ss=splitSentences(text);
  const desuPat=/(?:です|ます|でした|ました|ません|でしょう|ください)[。！？!?\s]*$/;
  const daPat=/(?:である|であった|だろう|ではない)[。！？!?\s]*$/;
  let dm=0,da=0;
  for(const s of ss){if(desuPat.test(s))dm++;else if(daPat.test(s))da++;}
  if(Math.min(dm,da)===0)return[text,[]];
  const recs=[]; let revised=text;
  if(dm>=da){
    const pairs=[[/である。/g,"です。"],[/であった。/g,"でした。"],[/だろう。/g,"でしょう。"],[/ではない。/g,"ではありません。"]];
    for(const[p,r]of pairs){const found=revised.match(p);if(found){for(const f of found)recs.push({id:"RV-39",desc:"→です/ます",before:f,after:r.replace(/\$/g,"")});revised=revised.replace(p,r);}}
  } else {
    const pairs=[[/です。/g,"である。"],[/でした。/g,"であった。"],[/でしょう。/g,"だろう。"],[/ではありません。/g,"ではない。"]];
    for(const[p,r]of pairs){const found=revised.match(p);if(found){for(const f of found)recs.push({id:"RV-39",desc:"→だ/である",before:f,after:r.replace(/\$/g,"")});revised=revised.replace(p,r);}}
  }
  return[revised,recs];
}

// ── DR-41 auto-fix: remove excess emphasis adverbs ──
function reviseEmphasisOveruse(text, limit) {
  const re=/(?:極めて|非常に|大変|きわめて|著しく|甚だ|格段に|圧倒的に|飛躍的に|劇的に|画期的に|抜本的に|顕著に)/g;
  const ms=[...text.matchAll(re)];
  if(ms.length<3)return[text,[]];
  const recs=[]; let revised=text;
  const toRemove=ms.slice(2).reverse().slice(0,limit);
  for(const m of toRemove){
    revised=revised.slice(0,m.index)+revised.slice(m.index+m[0].length);
    recs.push({id:"RV-41",desc:"強調語を削除",before:m[0],after:"(削除)"});
  }
  return[revised,recs];
}

// ── DR-43 auto-fix: fullwidth → halfwidth ──
function reviseFullwidthHalfwidth(text) {
  const map={}; for(let i=0;i<26;i++){map[String.fromCharCode(0xFF21+i)]=String.fromCharCode(65+i);map[String.fromCharCode(0xFF41+i)]=String.fromCharCode(97+i);}
  for(let i=0;i<10;i++)map[String.fromCharCode(0xFF10+i)]=String.fromCharCode(48+i);
  let c=0; const revised=text.replace(/[\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A]/g,m=>{c++;return map[m]||m;});
  return c>0?[revised,[{id:"RV-43",desc:`全角→半角 (${c}箇所)`,before:"１Ａ",after:"1A"}]]:[text,[]];
}

// ── DR-45 auto-fix: normalize symbols ──
function reviseSymbolMixing(text) {
  const recs=[]; let revised=text;
  const tc=(revised.match(/～/g)||[]).length;
  if(tc>0){revised=revised.replace(/～/g,"〜");recs.push({id:"RV-45",desc:`～→〜 (${tc})`,before:"～",after:"〜"});}
  const dc=(revised.match(/\.{3,}|．{3,}/g)||[]).length;
  if(dc>0){revised=revised.replace(/\.{3,}|．{3,}/g,"…");recs.push({id:"RV-45",desc:`...→… (${dc})`,before:"...",after:"…"});}
  return[revised,recs];
}

function runRevision(text, detection, globalCap = 8) {
  let revised = text; const allRecs = []; const skipped = [];
  const findingMap = {};
  for (const f of detection.allFindings) findingMap[f.id] = f;

  // ── Global Cap 外: 全削除ルール ──
  // DR-17 絵文字
  const f17 = findingMap["DR-17"];
  if (f17 && f17.score > 0) {
    const [t, r] = reviseEmojiBullet(revised, 9999);
    if (r.length) { revised = t; allRecs.push(...r); }
  }
  // DR-39 文体統一
  const f39 = findingMap["DR-39"];
  if (f39 && f39.score > 0) {
    const [t, r] = reviseStyleMixing(revised);
    if (r.length) { revised = t; allRecs.push(...r); }
  }
  // DR-43 全角半角
  const f43 = findingMap["DR-43"];
  if (f43 && f43.score > 0) {
    const [t, r] = reviseFullwidthHalfwidth(revised);
    if (r.length) { revised = t; allRecs.push(...r); }
  }
  // DR-45 記号統一
  const f45 = findingMap["DR-45"];
  if (f45 && f45.score > 0) {
    const [t, r] = reviseSymbolMixing(revised);
    if (r.length) { revised = t; allRecs.push(...r); }
  }

  // ── Global Cap 内: 3層制御ルール ──
  const uncappedRecs = allRecs.length;

  for (const ruleId of REVISION_ORDER) {
    const cappedCount = allRecs.length - uncappedRecs;
    if (cappedCount >= globalCap) { skipped.push(`${ruleId}: 全体上限到達`); continue; }
    const f = findingMap[ruleId]; if (!f || f.score === 0) continue;
    const fn = REVISION_FNS[ruleId]; if (!fn) continue;
    const ruleLim = PER_RULE_CAP[ruleId] || globalCap;
    const lim = Math.min(ruleLim, globalCap - cappedCount);
    if (lim <= 0) { skipped.push(`${ruleId}: 上限到達`); continue; }
    const [newText, recs] = fn(revised, f, lim);
    if (recs.length) { revised = newText; allRecs.push(...recs); }
  }
  return { revisedText: revised, records: allRecs, skipped };
}

// ═══════════════════════════════════════════════════════
//  PROMPT GENERATOR
// ═══════════════════════════════════════════════════════

function generatePrompts(text, detection) {
  const fm = {}; for (const f of detection.allFindings) fm[f.id] = f;
  const instructions = [];

  if (fm["DR-04"]?.score >= 0.3)
    instructions.push("・定型的な接続語（しかし、また、さらに等）が多すぎます。\n  一部を削除するか、具体的な接続に書き換えてください。\n  例:「したがって」→ 因果関係を具体的に書く");
  if (fm["DR-05"]?.score >= 0.3)
    instructions.push("・文末表現が単調です。バリエーションを増やしてください。\n  例:「〜である」「〜だ」「〜だろう」「〜かもしれない」を混ぜる、体言止めや疑問形を挟む");
  if (fm["DR-02"]?.score >= 0.4)
    instructions.push("・文の長さが均一すぎます。\n  短い文（体言止め）と長い文（複文）を混ぜてください");
  if (fm["DR-24"]?.score >= 0.4)
    instructions.push("・段落の長さが均一すぎます。\n  一部を結合するか、短い段落を意図的に作ってください");
  if (fm["DR-25"]?.score >= 0.5)
    instructions.push("・導入・結語に定型表現があります。\n  導入は具体的なエピソードから、結語は余韻や問いを残す形にしてください");
  if (fm["DR-21"]?.score >= 0.3)
    instructions.push("・箇条書きの項目数が3〜5個に偏っています。\n  統合・分割を検討してください");
  if (fm["DR-09"]?.score >= 0.5)
    instructions.push("・思考の痕跡（迷い、自問、言い直し）がありません。\n  「〜かもしれない」「正直なところ」「というか」等を適度に入れてください");
  if (fm["DR-07"]?.score >= 0.4)
    instructions.push("・抽象名詞（重要性、可能性、アプローチ等）が多すぎます。\n  具体的な名詞や動詞で書き換えてください");
  if (fm["DR-11"]?.score >= 0.4)
    instructions.push("・指示語（これ、その、ここ等）がほとんどありません。\n  文脈を受ける指示語を自然に入れてください");
  if (fm["DR-34"]?.score >= 0.3)
    instructions.push("・カタカナビジネス用語が集中しています。\n  日本語に置き換えられるものは置き換えてください");
  if (fm["DR-35"]?.score >= 0.3)
    instructions.push("・「第一に/第二に」のような機械的列挙があります。\n  自然な接続（まず/次に/また）や文脈に応じた流れにしてください");
  if (fm["DR-36"]?.score >= 0.3)
    instructions.push("・同じ語で文が始まる反復パターンがあります。\n  文頭を多様にしてください");
  if (fm["DR-37"]?.score >= 0.3)
    instructions.push("・「〜を行う」「〜の向上を図る」等の名詞化冗長表現があります。\n  直接動詞で書いてください（例: 検討を行う → 検討する）");
  if (fm["DR-38"]?.score >= 0.2)
    instructions.push("・「〜することが可能です」等の冗長な定型句があります。\n  簡潔に書き換えてください（例: 実現することが可能です → 実現できます）");
  if (fm["DR-40"]?.score >= 0.25)
    instructions.push("・「〜と考えられる」「〜と思われる」等の思考保留表現が多すぎます。\n  一部を断定に変えるか、削除してください（例: 有効であると考えられる → 有効である）");
  if (fm["DR-42"]?.score >= 0.3)
    instructions.push("・人称が混在しています（1人称と2人称が併存）。\n  文書全体で視点を統一してください");
  if (fm["DR-44"]?.score >= 0.3)
    instructions.push("・数字表記が算用数字と漢数字で揺れています。\n  文脈に合わせてどちらかに統一してください");
  if (fm["DR-46"]?.score >= 0.25)
    instructions.push("・疑問文の直後に断定文が続く「修辞疑問→即回答」パターンがあります。\n  疑問を説明文に変えるか、断定を柔らかくしてください");

  if (!instructions.length) return [];

  const header = `あなたは日本語の文章校正者です。\n以下の文章には体裁上の癖が残っています。\n意味や主張を変えずに、指示に従って自然な日本語に整えてください。\n修正後の全文のみを出力してください。\n\n─── 対象文章 ───\n${text}\n─── 修正指示 ───\n`;
  return [header + instructions.join("\n\n") + "\n\n─── 出力 ───\n修正後の全文を出力してください。"];
}

// ═══════════════════════════════════════════════════════
//  DIFF ENGINE
// ═══════════════════════════════════════════════════════

function computeDiff(orig, revised) {
  const a = orig.split("\n"), b = revised.split("\n");
  const result = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      result.push({ type: "same", text: a[i] }); i++; j++;
    } else if (j < b.length && (i >= a.length || !a.slice(i, i + 5).includes(b[j]))) {
      result.push({ type: "add", text: b[j] }); j++;
    } else if (i < a.length && (j >= b.length || !b.slice(j, j + 5).includes(a[i]))) {
      result.push({ type: "del", text: a[i] }); i++;
    } else {
      result.push({ type: "del", text: a[i] }); i++;
      result.push({ type: "add", text: b[j] }); j++;
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════
//  UI COMPONENTS
// ═══════════════════════════════════════════════════════

const FONTS = { mono: "'JetBrains Mono', 'Courier New', monospace", serif: "'Noto Serif JP', Georgia, serif", sans: "'Noto Sans JP', -apple-system, sans-serif" };

const THEMES = {
  dark: {
    name: "Dark", label: "暗",
    bg: "#0a0a0f", bgGrad1: "#0f0f1a", bgGrad2: "#0a0a12",
    card: "#0d0d14", border: "#ffffff0a",
    amber: "#f59e0b", blue: "#60a5fa", green: "#22c55e", red: "#ef4444",
    dim: "#525252", dimmer: "#3f3f46", text: "#d4d4d8", muted: "#a0a0a0",
    trackBg: "#1a1a2e", codeBg: "#06060c",
    tagVisBg: "#f59e0b12", tagStrBg: "#60a5fa12", tagFixBg: "#22c55e12",
    diffAddC: "#22c55e", diffDelC: "#ef4444", diffSameC: "#6b7280",
    diffAddBg: "#22c55e08", diffDelBg: "#ef444408",
    diffAddText: "#22c55e88", diffDelText: "#ef444488",
    emptyText: "#374151", footerText: "#2a2a3a", disclaimerBg: "#ffffff04",
    btnDisabledBg: "#1a1a2e", btnGrad: "#d97706",
    placeholder: "#3f3f46", focusBorder: "#f59e0b44", focusShadow: "#f59e0b22",
    scrollThumb: "#ffffff15", tabActiveBg: "#f59e0b18",
    lvRedBg: "rgba(239,68,68,0.15)", lvAmberBg: "rgba(245,158,11,0.15)", lvGreenBg: "rgba(34,197,94,0.15)",
    ...FONTS,
  },
  light: {
    name: "Light", label: "明",
    bg: "#f5f5f0", bgGrad1: "#ededea", bgGrad2: "#f5f5f0",
    card: "#ffffff", border: "#e0ddd5",
    amber: "#b45309", blue: "#2563eb", green: "#16a34a", red: "#dc2626",
    dim: "#9ca3af", dimmer: "#a1a1aa", text: "#1c1917", muted: "#57534e",
    trackBg: "#e7e5e4", codeBg: "#fafaf9",
    tagVisBg: "#b4530912", tagStrBg: "#2563eb12", tagFixBg: "#16a34a12",
    diffAddC: "#16a34a", diffDelC: "#dc2626", diffSameC: "#78716c",
    diffAddBg: "#16a34a0a", diffDelBg: "#dc26260a",
    diffAddText: "#16a34a", diffDelText: "#dc2626",
    emptyText: "#a8a29e", footerText: "#d6d3d1", disclaimerBg: "#00000006",
    btnDisabledBg: "#e7e5e4", btnGrad: "#92400e",
    placeholder: "#a8a29e", focusBorder: "#b4530944", focusShadow: "#b4530922",
    scrollThumb: "#00000015", tabActiveBg: "#b4530910",
    lvRedBg: "rgba(220,38,38,0.1)", lvAmberBg: "rgba(180,83,9,0.1)", lvGreenBg: "rgba(22,163,74,0.1)",
    ...FONTS,
  },
  ink: {
    name: "Ink", label: "墨",
    bg: "#f9f6f0", bgGrad1: "#f3ede4", bgGrad2: "#f9f6f0",
    card: "#faf8f3", border: "#d4c8b8",
    amber: "#92400e", blue: "#1d4ed8", green: "#15803d", red: "#b91c1c",
    dim: "#a8977e", dimmer: "#bfae96", text: "#292524", muted: "#6b5d4f",
    trackBg: "#e8dfd2", codeBg: "#f5f0e8",
    tagVisBg: "#92400e10", tagStrBg: "#1d4ed810", tagFixBg: "#15803d10",
    diffAddC: "#15803d", diffDelC: "#b91c1c", diffSameC: "#8b7e6e",
    diffAddBg: "#15803d08", diffDelBg: "#b91c1c08",
    diffAddText: "#15803d", diffDelText: "#b91c1c",
    emptyText: "#c4b8a5", footerText: "#d8cfc2", disclaimerBg: "#00000005",
    btnDisabledBg: "#e8dfd2", btnGrad: "#78350f",
    placeholder: "#b8a88e", focusBorder: "#92400e44", focusShadow: "#92400e22",
    scrollThumb: "#00000012", tabActiveBg: "#92400e0d",
    lvRedBg: "rgba(185,28,28,0.1)", lvAmberBg: "rgba(146,64,14,0.1)", lvGreenBg: "rgba(21,128,61,0.1)",
    ...FONTS,
  },
  midnight: {
    name: "Midnight", label: "夜",
    bg: "#0f172a", bgGrad1: "#1e293b", bgGrad2: "#0f172a",
    card: "#1e293b", border: "#334155",
    amber: "#fbbf24", blue: "#38bdf8", green: "#4ade80", red: "#f87171",
    dim: "#64748b", dimmer: "#475569", text: "#e2e8f0", muted: "#94a3b8",
    trackBg: "#1e293b", codeBg: "#0f172a",
    tagVisBg: "#fbbf2415", tagStrBg: "#38bdf815", tagFixBg: "#4ade8015",
    diffAddC: "#4ade80", diffDelC: "#f87171", diffSameC: "#64748b",
    diffAddBg: "#4ade8008", diffDelBg: "#f8717108",
    diffAddText: "#4ade8088", diffDelText: "#f8717188",
    emptyText: "#475569", footerText: "#334155", disclaimerBg: "#ffffff05",
    btnDisabledBg: "#1e293b", btnGrad: "#d97706",
    placeholder: "#475569", focusBorder: "#fbbf2444", focusShadow: "#fbbf2422",
    scrollThumb: "#ffffff12", tabActiveBg: "#fbbf2415",
    lvRedBg: "rgba(248,113,113,0.15)", lvAmberBg: "rgba(251,191,36,0.15)", lvGreenBg: "rgba(74,222,128,0.15)",
    ...FONTS,
  },
};

function ScoreBar({ label, score, color, C }) {
  const pct = Math.round(score * 100);
  const lv = score >= 0.7 ? "多" : score >= 0.4 ? "中" : "少";
  const lvBg = score >= 0.7 ? C.lvRedBg : score >= 0.4 ? C.lvAmberBg : C.lvGreenBg;
  const lvC = score >= 0.7 ? C.red : score >= 0.4 ? C.amber : C.green;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontFamily: C.serif, fontSize: 12, letterSpacing: "0.08em", color: C.muted }}>{label}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: C.mono, fontSize: 26, fontWeight: 700, color, letterSpacing: "-0.02em" }}>{score.toFixed(2)}</span>
          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 3, background: lvBg, color: lvC }}>{lv}</span>
        </div>
      </div>
      <div style={{ height: 5, background: C.trackBg, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)" }} />
      </div>
    </div>
  );
}

function FindingRow({ f, idx, C }) {
  const mk = f.score >= 0.5 ? "●" : f.score >= 0.3 ? "○" : "·";
  const mc = f.score >= 0.5 ? C.amber : f.score >= 0.3 ? C.dim : C.dimmer;
  return (
    <div style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}`, animation: `fadeSlide 0.3s ease ${idx * 0.03}s both` }}>
      <span style={{ color: mc, fontSize: 13, width: 14, textAlign: "center", marginTop: 2, flexShrink: 0 }}>{mk}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <code style={{ fontSize: 10, color: f.cat === "visual" ? C.amber : C.blue, background: f.cat === "visual" ? C.tagVisBg : C.tagStrBg, padding: "1px 5px", borderRadius: 3, fontFamily: C.mono }}>{f.id}</code>
          <span style={{ fontSize: 12, color: C.text }}>{f.name}</span>
          {f.count > 0 && <span style={{ fontSize: 10, color: C.dim }}>({f.count})</span>}
        </div>
        {f.detail && <div style={{ fontSize: 10, color: C.dim, marginTop: 2, fontFamily: C.mono }}>{f.detail}</div>}
      </div>
      <span style={{ fontSize: 11, fontFamily: C.mono, color: C.dim, width: 32, textAlign: "right", marginTop: 2, flexShrink: 0 }}>{f.score.toFixed(2)}</span>
    </div>
  );
}

function TabButton({ active, label, onClick, C }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 20px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", borderRadius: "6px 6px 0 0", transition: "all 0.2s",
      background: active ? C.tabActiveBg : "transparent", color: active ? C.amber : C.dim, borderBottom: active ? `2px solid ${C.amber}` : "2px solid transparent",
    }}>{label}</button>
  );
}

// ── MAIN APP ──

const SAMPLE_AI = `効率的な時間管理は、現代社会において非常に重要なスキルです。以下のポイントを押さえることで、生産性を大幅に向上させることができます。

まず、以下の3つの基本原則を理解しましょう：
📊 データに基づく計画立案
🎯 明確な目標設定
⏰ 定期的な振り返り

これらの要素を組み合わせることで、効率的なアプローチが可能になります。特に、**優先順位の設定**と**タスクの分類**が重要です。

さらに、以下のような具体的な手法も活用できます。**ポモドーロテクニック**は集中力を高める効果があります。また、**タスクバッチング**により関連作業をまとめることで効率性が向上します。

いかがでしたか。ぜひ参考にしてください。`;

const SAMPLE_HUMAN = `きのう久しぶりに大学時代の友人と会った。正直、最初はちょっと気まずいかなと思ってたんだけど、会った瞬間にそんな心配は吹き飛んだ。

やっぱり気の合う人って、時間が空いてもすぐ元に戻れるんだな——というか、むしろ前より話しやすくなってた気がする。お互い社会人になって、なんというか、余計な見栄みたいなものが薄れたのかもしれない。

帰りの電車で、ふと「こういう関係って大事にしなきゃな」と思った。まあ、思うだけで連絡まめにするかっていうと……たぶんまた半年くらい空くんだろうけど。それでもいいのかな、と思えるのが友達ってことなのかもしれない。`;

export default function QsayApp() {
  const [text, setText] = useState("");
  const [tab, setTab] = useState("scan");
  const [result, setResult] = useState(null);
  const [revision, setRevision] = useState(null);
  const [prompts, setPrompts] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [themeKey, setThemeKey] = useState(() => {
    try { const s = localStorage.getItem("qsay-theme"); return s && THEMES[s] ? s : "dark"; } catch { return "dark"; }
  });
  const changeTheme = useCallback((k) => {
    setThemeKey(k);
    try { localStorage.setItem("qsay-theme", k); } catch {}
  }, []);
  const taRef = useRef(null);

  const C = THEMES[themeKey];

  const doAnalyze = useCallback(() => {
    if (!text.trim()) return;
    setBusy(true);
    setTimeout(() => {
      const det = runDetection(text);
      setResult(det);
      const rev = runRevision(text, det);
      const afterDet = runDetection(rev.revisedText);
      setRevision({ ...rev, beforeScore: det, afterScore: afterDet });
      const pr = generatePrompts(text, det);
      setPrompts(pr);
      setBusy(false);
    }, 200);
  }, [text]);

  const handleKey = useCallback((e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); doAnalyze(); } }, [doAnalyze]);
  const clear = () => { setText(""); setResult(null); setRevision(null); setPrompts(null); };
  const copyText = (t, label) => { navigator.clipboard.writeText(t).then(() => { setCopied(label); setTimeout(() => setCopied(""), 1500); }); };

  const vFindings = result ? result.findings.filter(f => f.cat === "visual") : [];
  const sFindings = result ? result.findings.filter(f => f.cat === "structural") : [];
  const diffLines = revision ? computeDiff(text, revision.revisedText) : [];

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${C.bg} 0%, ${C.bgGrad1} 50%, ${C.bgGrad2} 100%)`, color: C.text, fontFamily: C.sans, transition: "background 0.4s ease, color 0.3s ease" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=Noto+Serif+JP:wght@400;700&family=JetBrains+Mono:wght@400;600;700&display=swap');
        @keyframes fadeSlide { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        textarea::placeholder { color: ${C.placeholder}; } textarea:focus { outline:none; border-color:${C.focusBorder} !important; box-shadow:0 0 0 1px ${C.focusShadow}; }
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:${C.scrollThumb};border-radius:3px}
        .copy-btn { padding:5px 10px; border:1px solid ${C.border}; background:transparent; color:${C.dim}; font-size:10px; border-radius:4px; cursor:pointer; transition:all 0.2s; }
        .copy-btn:hover { border-color:${C.amber}44; color:${C.amber}; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "28px 28px 0", maxWidth: 920, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
          <h1 style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 700, color: C.amber, letterSpacing: "-0.03em", margin: 0 }}>qsay</h1>
          <span style={{ fontSize: 10, color: C.dimmer, fontFamily: C.mono }}>v0.3.0 · 34 rules</span>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 2 }}>
            {Object.entries(THEMES).map(([key, t]) => (
              <button key={key} onClick={() => changeTheme(key)} title={t.name} style={{
                width: 26, height: 26, borderRadius: 4, border: key === themeKey ? `2px solid ${C.amber}` : `1px solid ${C.border}`,
                background: t.bg, cursor: "pointer", fontSize: 9, color: t.text, display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s", opacity: key === themeKey ? 1 : 0.6,
              }}>{t.label}</button>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 12, color: C.dimmer, margin: 0, letterSpacing: "0.02em" }}>体裁上の癖を可視化し、緩和するツール</p>
      </div>

      {/* Input */}
      <div style={{ padding: "20px 28px", maxWidth: 920, margin: "0 auto" }}>
        <textarea ref={taRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKey}
          placeholder="テキストを貼り付けてください…" rows={8}
          style={{ width: "100%", boxSizing: "border-box", resize: "vertical", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, fontSize: 13, lineHeight: 1.8, color: C.text, fontFamily: C.sans }} />
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={doAnalyze} disabled={!text.trim() || busy}
            style={{ padding: "7px 22px", borderRadius: 6, border: "none", cursor: "pointer", background: text.trim() ? `linear-gradient(135deg, ${C.amber}, ${C.btnGrad})` : C.btnDisabledBg, color: text.trim() ? C.bg : C.dimmer, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", opacity: busy ? 0.7 : 1, transition: "all 0.2s" }}>
            {busy ? "解析中…" : "解析する"}
          </button>
          <span style={{ fontSize: 10, color: C.dimmer, fontFamily: C.mono }}>⌘+Enter</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => { setText(SAMPLE_AI); setResult(null); setRevision(null); setPrompts(null); }}
            style={{ padding: "5px 10px", borderRadius: 4, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontSize: 10, cursor: "pointer" }}>AI文</button>
          <button onClick={() => { setText(SAMPLE_HUMAN); setResult(null); setRevision(null); setPrompts(null); }}
            style={{ padding: "5px 10px", borderRadius: 4, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontSize: 10, cursor: "pointer" }}>人間文</button>
          {text && <button onClick={clear} style={{ padding: "5px 10px", borderRadius: 4, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontSize: 10, cursor: "pointer" }}>クリア</button>}
        </div>
      </div>

      {/* Tabs + Results */}
      {result && (
        <div style={{ padding: "0 28px 48px", maxWidth: 920, margin: "0 auto", animation: "fadeSlide 0.4s ease" }}>
          {/* Tab bar */}
          <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
            <TabButton active={tab === "scan"} label="解析" onClick={() => setTab("scan")} C={C} />
            <TabButton active={tab === "fix"} label="修正" onClick={() => setTab("fix")} C={C} />
            <TabButton active={tab === "prompt"} label="プロンプト" onClick={() => setTab("prompt")} C={C} />
          </div>

          {/* ── SCAN TAB ── */}
          {tab === "scan" && <>
            <div style={{ display: "flex", gap: 20, padding: "10px 0", marginBottom: 16, borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
              {[["文字数", result.stats.chars], ["段落", result.stats.paragraphs], ["文", result.stats.sentences]].map(([l, v]) => (
                <div key={l} style={{ display: "flex", gap: 5, alignItems: "baseline" }}>
                  <span style={{ fontSize: 10, color: C.dim }}>{l}</span>
                  <span style={{ fontSize: 13, fontFamily: C.mono, color: C.muted }}>{v}</span>
                </div>
              ))}
              {result.stats.chars < 100 && <span style={{ fontSize: 10, color: `${C.amber}88`, marginLeft: "auto" }}>⚠ 短文のため精度低下の可能性</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginBottom: 28 }}>
              <ScoreBar C={C} label="VISUAL KUSE SCORE" score={result.visualScore} color={C.amber} />
              <ScoreBar C={C} label="STRUCTURAL KUSE SCORE" score={result.structuralScore} color={C.blue} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color: `${C.amber}88`, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${C.amber}15` }}>VISUAL — {vFindings.length}件</div>
                {vFindings.length === 0 ? <div style={{ fontSize: 11, color: C.emptyText, padding: "12px 0" }}>検出なし ✓</div> : vFindings.map((f, i) => <FindingRow key={f.id} f={f} idx={i} C={C} />)}
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color: `${C.blue}88`, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${C.blue}15` }}>STRUCTURAL — {sFindings.length}件</div>
                {sFindings.length === 0 ? <div style={{ fontSize: 11, color: C.emptyText, padding: "12px 0" }}>検出なし ✓</div> : sFindings.map((f, i) => <FindingRow key={f.id} f={f} idx={i} C={C} />)}
              </div>
            </div>
          </>}

          {/* ── FIX TAB ── */}
          {tab === "fix" && revision && <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, color: C.dim, marginBottom: 4, fontFamily: C.mono }}>BEFORE</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <ScoreBar C={C} label="Visual" score={revision.beforeScore.visualScore} color={C.amber} />
                  <ScoreBar C={C} label="Structural" score={revision.beforeScore.structuralScore} color={C.blue} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.green, marginBottom: 4, fontFamily: C.mono }}>AFTER</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <ScoreBar C={C} label="Visual" score={revision.afterScore.visualScore} color={C.amber} />
                  <ScoreBar C={C} label="Structural" score={revision.afterScore.structuralScore} color={C.blue} />
                </div>
              </div>
            </div>

            {/* Records */}
            {revision.records.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color: `${C.green}aa`, marginBottom: 8 }}>自動修正 — {revision.records.length}件</div>
                {revision.records.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 11, animation: `fadeSlide 0.3s ease ${i * 0.05}s both` }}>
                    <code style={{ fontSize: 9, color: C.green, background: C.tagFixBg, padding: "1px 5px", borderRadius: 3, fontFamily: C.mono, flexShrink: 0 }}>{r.id}</code>
                    <span style={{ color: C.muted }}>{r.desc}</span>
                    <span style={{ color: C.diffSameC, fontFamily: C.mono, fontSize: 10 }}>
                      <span style={{ color: C.diffDelText, textDecoration: "line-through" }}>{r.before}</span>
                      {" → "}
                      <span style={{ color: C.diffAddText }}>{r.after}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {revision.records.length === 0 && <div style={{ fontSize: 12, color: C.dim, padding: "16px 0", marginBottom: 16 }}>自動修正の対象なし（構造・文体の癖はプロンプトタブで対応）</div>}

            {/* Diff */}
            {diffLines.some(d => d.type !== "same") && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color: C.muted }}>DIFF</span>
                </div>
                <div style={{ background: C.codeBg, borderRadius: 6, padding: 12, fontFamily: C.mono, fontSize: 11, lineHeight: 1.7, maxHeight: 300, overflowY: "auto", border: `1px solid ${C.border}` }}>
                  {diffLines.map((d, i) => (
                    <div key={i} style={{ color: d.type === "add" ? C.diffAddC : d.type === "del" ? C.diffDelC : C.diffSameC, background: d.type === "add" ? C.diffAddBg : d.type === "del" ? C.diffDelBg : "transparent", padding: "1px 4px", borderRadius: 2 }}>
                      {d.type === "add" ? "+" : d.type === "del" ? "-" : " "} {d.text || "\u00A0"}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Revised text */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color: C.muted }}>修正後テキスト</span>
                <button className="copy-btn" onClick={() => copyText(revision.revisedText, "revised")}>{copied === "revised" ? "✓ コピー済" : "コピー"}</button>
              </div>
              <div style={{ background: C.card, borderRadius: 6, padding: 14, fontSize: 13, lineHeight: 1.8, border: `1px solid ${C.border}`, whiteSpace: "pre-wrap", maxHeight: 400, overflowY: "auto" }}>
                {revision.revisedText}
              </div>
            </div>

            {revision.skipped.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 10, color: C.dimmer }}>
                <span style={{ color: C.dim }}>⚠ スキップ:</span> {revision.skipped.join(" / ")}
              </div>
            )}
          </>}

          {/* ── PROMPT TAB ── */}
          {tab === "prompt" && <>
            {prompts && prompts.length > 0 ? (
              prompts.map((p, i) => (
                <div key={i} style={{ marginBottom: 20, animation: "fadeSlide 0.4s ease" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>修正プロンプト</span>
                    <button className="copy-btn" onClick={() => copyText(p, `prompt-${i}`)}>{copied === `prompt-${i}` ? "✓ コピー済" : "コピー"}</button>
                  </div>
                  <div style={{ background: C.codeBg, borderRadius: 6, padding: 16, fontFamily: C.mono, fontSize: 11, lineHeight: 1.8, border: `1px solid ${C.border}`, whiteSpace: "pre-wrap", maxHeight: 500, overflowY: "auto", color: C.muted }}>
                    {p.split("\n").map((line, li) => {
                      if (line.startsWith("───")) return <div key={li} style={{ color: C.amber, fontWeight: 600, margin: "8px 0 4px" }}>{line}</div>;
                      if (line.startsWith("・")) return <div key={li} style={{ color: C.text, marginLeft: 4 }}>{line}</div>;
                      if (line.startsWith("  ")) return <div key={li} style={{ color: C.dim, marginLeft: 16 }}>{line}</div>;
                      return <div key={li}>{line}</div>;
                    })}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: C.dim }}>
                    ↑ このプロンプトをClaude等のAIに貼り付けて、構造・文体の癖を修正してもらえます
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: "32px 0", textAlign: "center", animation: "fadeSlide 0.4s ease" }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>✓</div>
                <div style={{ fontSize: 13, color: C.dim }}>プロンプト生成の対象となる癖が検出されませんでした</div>
                <div style={{ fontSize: 11, color: C.dimmer, marginTop: 6 }}>構造・文体に関する癖のスコアが閾値以下です</div>
              </div>
            )}
          </>}

          {/* Disclaimer */}
          <div style={{ marginTop: 28, padding: 14, borderRadius: 6, background: C.disclaimerBg, border: `1px solid ${C.border}`, fontSize: 10, color: C.dimmer, lineHeight: 1.7 }}>
            <span style={{ color: C.dim }}>⚠</span> 本結果は体裁上の癖の検出であり、文章の良し悪しや出自を断定するものではありません。短文では精度が低下します。
            <span style={{ display: "block", marginTop: 3, fontFamily: C.mono, color: C.footerText }}>qsay v0.3.0 · 34 rules · scan + fix + prompt</span>
          </div>
        </div>
      )}
    </div>
  );
}
