/* 김도영 Profile / 순수 JavaScript
   태그 필터, 상세 팝업, 갤러리, 모바일 메뉴, 스크롤 효과를 담당합니다.
   공개 데이터는 index.html의 public-data에서 읽습니다. */
(function () {
  'use strict';

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const visible = records => records.filter(item => item.visibility !== 'hidden').slice().sort((a,b) => a.order-b.order);
  const sectionNames = ['배경','담당 범위','전략','결과','배운 점'];
  function isSafeExternal(value) { try { const u=new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; } }
  // GitHub에는 로고/·스킬/·학습기록/·각 프로젝트 폴더가 index.html 옆에 있습니다.
  // localURL/data-local-src는 기존 사진/ 폴더를 사용하는 로컬 실행용 경로입니다.
  function safeAssetURL(value) {
    if(typeof value!=='string'||!value)return false;
    let decoded;try {decoded=decodeURIComponent(value).replace(/^\.\//,'');}catch{return false;}
    // 상대 파일 경로만 허용합니다. 외부 주소·상위 폴더 이동·제어 문자는 차단합니다.
    if(/[\\\u0000-\u001f:#?]/.test(decoded))return false;
    const parts=decoded.split('/');
    return !parts.some(part=>!part||part==='.'||part==='..')&&/\.(png|jpe?g|gif|webp|avif|svg|mp4|webm)$/i.test(decoded);
  }
  function resolveAssetURL(url,localURL) {
    const path=location.protocol==='file:'&&safeAssetURL(localURL)?localURL:url;
    if(!safeAssetURL(path))return '';
    // 경로의 각 이름을 인코딩해 한글·공백을 처리하고 /my_profile/ 하위 경로를 유지합니다.
    return decodeURIComponent(path).replace(/^\.\//,'').split('/').map(encodeURIComponent).join('/');
  }
  // RENDER: 안전한 제한 Markdown(문단·목록·강조 제목)을 HTML로 바꿉니다. 원문 HTML을 실행하지 않습니다.
  function markdown(text, emphasisPhrases=[], accentPhrases=[]) {
    // emphasisPhrases와 accentPhrases는 핵심 역량·역할·성과에 파란색 강조를 적용합니다.
    // 지정한 문구만 강조하고 모든 원문은 이스케이프해 HTML 실행을 방지합니다.
    const inline=value=>{
      const source=String(value), phrases=[
        ...emphasisPhrases.filter(Boolean).map(value=>({value,className:'text-emphasis'})),
        ...accentPhrases.filter(Boolean).map(value=>({value,className:'project-emphasis'}))
      ];
      let result='', cursor=0;
      while(cursor<source.length) {
        let next=-1, chosen='', chosenClass='';
        for(const phrase of phrases) {
          const index=source.indexOf(phrase.value,cursor);
          if(index>=0&&(next<0||index<next||(index===next&&phrase.value.length>chosen.length))) {
            next=index;chosen=phrase.value;chosenClass=phrase.className;
          }
        }
        if(next<0) {result+=escapeHTML(source.slice(cursor));break;}
        result+=escapeHTML(source.slice(cursor,next))+'<span class="'+chosenClass+'">'+escapeHTML(chosen)+'</span>';
        cursor=next+chosen.length;
      }
      return result;
    };
    let html='', list=false, paragraph=[];
    const flush=()=>{ if (paragraph.length) { html+='<p>'+paragraph.map(inline).join(' ')+'</p>'; paragraph=[]; } };
    for (const line of String(text || '').split(/\r?\n/)) {
      if (/^- /.test(line)) { flush(); if (!list) {html+='<ul>';list=true;} html+='<li>'+inline(line.slice(2))+'</li>'; }
      else { if (list) {html+='</ul>';list=false;} if (!line.trim()) flush(); else if (/^\*\*.+\*\*$/.test(line)) {flush();html+='<h4>'+inline(line.slice(2,-2))+'</h4>';} else paragraph.push(line); }
    }
    flush(); if(list) html+='</ul>'; return html;
  }
  function media(data,id,{label='사진 준비 중',className='',fallback='',eager=false,fit}={}) {
    const asset=data.assets.find(item=>item.id===id);
    const url=resolveAssetURL(asset?.url,asset?.localURL);
    let content='';
    if(url&&asset.kind==='video') {
      // 지정된 영상은 모바일에서도 음소거 상태로 자동 반복 재생합니다.
      const playback=asset.autoplay?' autoplay muted playsinline':'';
      content=`<video src="${escapeHTML(url)}" controls${playback}${asset.loop?' loop':''} preload="${asset.autoplay?'auto':'metadata'}" aria-label="${escapeHTML(asset.alt||'프로젝트 영상')}"></video>`;
    } else if(url) {
      // 원본 크기를 함께 제공해 세로 사진도 처음부터 알맞은 높이를 예약합니다.
      const dimensions=asset.width&&asset.height?` width="${asset.width}" height="${asset.height}"`:'';
      content=`<img src="${escapeHTML(url)}" alt="${escapeHTML(asset.alt||'')}"${dimensions} loading="${eager?'eager':'lazy'}" decoding="async">`;
    }
    return `<div class="media ${className}" style="--fit:${fit||asset?.fit||'contain'}" data-asset="${escapeHTML(id||'')}"><div class="media-fallback">${fallback||escapeHTML(label)}</div>${content}</div>`;
  }
  function tags(item,types,group,interactive=true) {
    return `<div class="tags">${(item.typeIds || []).map(id=>{const t=types.find(t=>t.id===id); if(!t)return '';return interactive?`<button type="button" class="tag" data-filter-group="${group}" data-type="${escapeHTML(id)}" aria-pressed="false">${escapeHTML(t.title)}</button>`:`<span class="tag">${escapeHTML(t.title)}</span>`;}).join('')}</div>`;
  }
  function detailSections(project) { return `<div class="detail-sections">${sectionNames.map(name=>`<section class="detail-section"><h3>${name}</h3>${markdown(project.sections[name],project.emphasisPhrases,project.accentPhrases)}</section>`).join('')}</div>`; }

  // CLIENT_STATE: Project와 Skills의 필터 선택, 팝업, 갤러리 상태를 관리합니다.
  const $=selector=>document.querySelector(selector), $$=selector=>[...document.querySelectorAll(selector)];
  const data=JSON.parse($('#public-data').textContent), selected={project:'all',skill:'all'};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let observer,dialogOpener,lockedY=0,menuOpen=false;
  const dialog=$('#detail-dialog'),publicSite=$('#public-site');
  // ASSET: 일반 사진과 휴대폰 화면의 로딩·오류를 감지합니다.
  // 휴대폰 사진이 없으면 프레임 크기를 유지하며 중립적인 자리표시를 보여줍니다.
  function prepareImages(scope=document) {
    scope.querySelectorAll('.media img,.phone-screen img,.media video').forEach(element=>{
      const box=element.closest('.media,.phone-screen');
      if(!box)return;
      const isImage=element.tagName==='IMG';
      const markLoaded=()=>{box.classList.remove('failed');box.classList.add('loaded');};
      const markFailed=()=>{box.classList.remove('loaded');box.classList.add('failed');};
      // 한 요소에 중복 이벤트를 등록하지 않으며, 성공 시 이전 실패 상태도 해제합니다.
      if(!element.dataset.assetPrepared) {
        element.dataset.assetPrepared='true';
        element.addEventListener(isImage?'load':'loadedmetadata',markLoaded);
        element.addEventListener('error',markFailed);
      }
      const url=resolveAssetURL(element.getAttribute('src'),element.dataset.localSrc);
      if(!url) {markFailed();return;}
      if(element.getAttribute('src')!==url) {
        box.classList.remove('loaded','failed');
        element.setAttribute('src',url);
        if(!isImage)element.load();
      }
      if(isImage&&element.complete) {element.naturalWidth?markLoaded():markFailed();}
      else if(!isImage&&element.readyState>=1)markLoaded();
    });
  }
  // REVEAL: 화면에 들어올 때 떠오르고, 완전히 벗어나면 초기화해 재진입 시 반복합니다.
  function prepareReveal(scope=publicSite) {
    const targets=[...scope.querySelectorAll('[data-reveal]')].filter(el=>el.dataset.competency===undefined&&!(el.dataset.experience!==undefined&&experiencePinned));
    // 모션 감소 설정이나 관찰 기능이 없는 환경에서는 모든 콘텐츠를 바로 보여줍니다.
    if(reduced.matches||!('IntersectionObserver' in window)) {
      observer?.disconnect();
      observer=null;
      targets.forEach(el=>{el.classList.remove('reveal-pending');el.classList.add('is-visible');el.style.transitionDelay='';});
      return;
    }
    if(!observer) {
      observer=new IntersectionObserver(entries=>{
        let sequence=0;
        entries.forEach(entry=>{
          const el=entry.target;
          if(entry.isIntersecting) {
            // 같은 화면의 요소를 조금씩 순서대로 보여주되 지연이 길어지지 않게 합니다.
            el.style.transitionDelay=Math.min(sequence++*65,260)+'ms';
            el.classList.add('is-visible');
          } else {
            // 위로 벗어난 요소는 더 위로 숨겨 경계에서 위치가 흔들리지 않게 합니다.
            el.classList.toggle('reveal-from-above',entry.boundingClientRect.bottom<=0);
            el.style.transitionDelay='0ms';
            el.classList.remove('is-visible');
          }
        });
      },{rootMargin:'0px 0px -24px 0px',threshold:0});
    }
    targets.forEach(el=>{
      if(el.classList.contains('reveal-pending'))return;
      el.classList.remove('is-visible');
      el.classList.add('reveal-pending');
      // 관찰을 해제하지 않아 위아래로 스크롤할 때마다 효과가 다시 작동합니다.
      observer.observe(el);
    });
  }
  // COMPETENCY PIN: 고정 무대의 스크롤 진행률에 따라 01→02→03→04를 차례로 공개합니다.
  let competencyCards=[],competencyPinned=false,competencyDistance=0,competencyPinTop=0;
  function prepareCompetencies() {
    const pin=$('#competency-pin');
    competencyCards=$$('[data-competency]');
    if(!pin||!competencyCards.length)return;
    const animate=!reduced.matches&&'IntersectionObserver' in window;
    const navHeight=$('.site-header').getBoundingClientRect().height;
    const stageHeight=Math.max(260,innerHeight-navHeight-32);
    competencyPinTop=navHeight+16;
    // 마지막 카드가 나타난 뒤에도 읽을 수 있는 여유 구간을 둡니다.
    competencyDistance=Math.max(960,innerHeight*1.6);
    pin.style.setProperty('--competency-top',competencyPinTop+'px');
    pin.style.setProperty('--competency-height',stageHeight+'px');
    pin.style.setProperty('--competency-distance',competencyDistance+'px');
    competencyPinned=animate&&innerHeight>=500;
    pin.classList.toggle('is-pinned',competencyPinned);
    // 매우 낮은 화면에서는 카드 전체를 읽을 수 있도록 일반 스크롤로 전환합니다.
    const inner=pin.querySelector('.competency-stage-inner');
    if(competencyPinned&&inner.offsetHeight>stageHeight) {
      competencyPinned=false;
      pin.classList.remove('is-pinned');
    }
    competencyCards.forEach(card=>{
      card.classList.toggle('reveal-pending',animate);
      card.classList.toggle('is-visible',!animate);
      card.classList.remove('reveal-from-above');
      card.style.transitionDelay='0ms';
    });
    updateCompetencies();
  }
  function updateCompetencies() {
    if(reduced.matches||!('IntersectionObserver' in window))return;
    if(competencyPinned) {
      const pin=$('#competency-pin');
      const distance=competencyPinTop-pin.getBoundingClientRect().top;
      const progress=Math.max(0,Math.min(1,distance/competencyDistance));
      const count=distance<0?0:Math.min(competencyCards.length,1+Math.floor(progress*competencyCards.length));
      let sequence=0;
      competencyCards.forEach((card,index)=>{
        const show=index<count;
        if(show&&!card.classList.contains('is-visible'))card.style.transitionDelay=Math.min(sequence++*120,360)+'ms';
        if(!show)card.style.transitionDelay='0ms';
        card.classList.toggle('is-visible',show);
      });
      return;
    }
    // 고정할 공간이 부족한 화면에서도 자연스러운 스크롤 등장을 유지합니다.
    const columns=innerWidth>=1200?4:innerWidth>=768?2:1;
    let sequence=0;
    competencyCards.forEach((card,index)=>{
      const rect=card.closest('.competency-slot').getBoundingClientRect();
      const trigger=innerHeight*(.8-(index%columns)*.06);
      if(rect.top<=trigger&&rect.bottom>0&&!card.classList.contains('is-visible')) {
        card.style.transitionDelay=Math.min(sequence++*150,450)+'ms';
        card.classList.add('is-visible');
      } else if(rect.bottom<=0||rect.top>=innerHeight) {
        card.style.transitionDelay='0ms';
        card.classList.toggle('reveal-from-above',rect.bottom<=0);
        card.classList.remove('is-visible');
      }
    });
  }

  // EXPERIENCE DURATION: 종료된 경력만 시작·종료 월을 포함해 계산합니다. '현재'인 경력은 표시하지 않습니다.
  function formatExperienceDuration(period) {
    const range=String(period||'').match(/^(\d{4})년\s*(\d{1,2})월\s*~\s*(\d{4})년\s*(\d{1,2})월$/);
    if(!range)return '';
    const startYear=Number(range[1]),startMonth=Number(range[2]);
    const endYear=Number(range[3]),endMonth=Number(range[4]);
    if(startMonth<1||startMonth>12||endMonth<1||endMonth>12)return '';
    const months=(endYear-startYear)*12+endMonth-startMonth+1;
    if(months<=0)return '';
    const years=Math.floor(months/12),remaining=months%12;
    return years?'('+years+'년 '+remaining+'개월)':'('+months+'개월)';
  }
  function updateExperienceDurations() {
    $$('[data-experience-duration]').forEach(label=>{
      const experience=data.experiences.find(item=>item.id===label.dataset.experienceDuration);
      label.textContent=formatExperienceDuration(experience?.period);
    });
  }

  // EXPERIENCE PIN: 스크롤 한 단계마다 경력 하나를 중앙에 놓고 앞뒤 경력만 옅게 표시합니다.
  let experienceCards=[],experiencePinned=false,experienceIndex=-1,experienceStep=0,experiencePinTop=0,experienceCardHeight=0,experienceNeighborHeight=0;
  function prepareExperience() {
    // 기간이 줄바꿈될 수 있으므로 근무 기간을 먼저 표시한 후 카드 높이를 측정합니다.
    updateExperienceDurations();
    const pin=$('#experience-pin'),viewport=$('#experience-viewport'),status=$('#experience-progress');
    experienceCards=$$('[data-experience]');
    if(!pin||!viewport||!experienceCards.length)return;
    experienceIndex=-1;
    experienceCards.forEach(card=>{
      observer?.unobserve(card);
      card.classList.remove('reveal-pending','reveal-from-above','is-visible','is-experience-active','is-experience-neighbor');
      card.style.transitionDelay='';
      card.removeAttribute('aria-hidden');
    });
    const navHeight=$('.site-header').getBoundingClientRect().height;
    experiencePinTop=navHeight+12;
    const stageHeight=innerHeight-navHeight-24;
    // 한 항목을 읽고 다음 항목으로 넘어가는 스크롤 길이는 여기서 조절합니다.
    experienceStep=Math.max(360,innerHeight*.58);
    pin.style.setProperty('--experience-top',experiencePinTop+'px');
    pin.style.setProperty('--experience-stage-height',stageHeight+'px');
    pin.style.setProperty('--experience-distance',experienceCards.length*experienceStep+'px');
    pin.style.removeProperty('--experience-card-height');
    experiencePinned=!reduced.matches&&experienceCards.length>=3&&innerHeight>=600;
    pin.classList.toggle('is-pinned',experiencePinned);
    status.hidden=!experiencePinned;
    status.textContent='01 / '+String(experienceCards.length).padStart(2,'0');
    if(experiencePinned) {
      // 가장 긴 원문 높이에 맞춰 무대를 예약하므로 가운데 설명이 잘리지 않습니다.
      experienceCardHeight=Math.max(...experienceCards.map(card=>Math.ceil(card.scrollHeight)+2));
      pin.style.setProperty('--experience-card-height',experienceCardHeight+'px');
      // 설명 전체와 앞뒤 카드가 보일 공간이 없으면 읽기 편한 일반 목록으로 전환합니다.
      const minimumPreview=innerWidth<768?100:64;
      experienceNeighborHeight=Math.min(112,Math.max(minimumPreview,Math.floor((viewport.clientHeight-experienceCardHeight-24)/1.8)));
      pin.style.setProperty('--experience-neighbor-height',experienceNeighborHeight+'px');
      if(viewport.clientHeight<experienceCardHeight+experienceNeighborHeight*1.8+24) {
        experiencePinned=false;pin.classList.remove('is-pinned');status.hidden=true;
      }
    }
    if(experiencePinned) {
      viewport.tabIndex=0;
      viewport.setAttribute('aria-label','경력 목록, 위아래 화살표로 경력 이동');
      updateExperience();
    } else {
      viewport.removeAttribute('tabindex');
      viewport.setAttribute('aria-label','경력 목록');
    }
  }
  function updateExperience() {
    if(!experiencePinned)return;
    const pin=$('#experience-pin');
    const distance=experiencePinTop-pin.getBoundingClientRect().top;
    const index=Math.max(0,Math.min(experienceCards.length-1,Math.floor(Math.max(0,distance)/experienceStep)));
    if(index===experienceIndex)return;
    experienceIndex=index;
    const count=experienceCards.length,previous=index-1,next=index+1;
    // 실제 앞뒤 경력만 표시합니다. 처음에는 위쪽, 마지막에는 아래쪽 미리보기가 없습니다.
    const offset=(experienceCardHeight+experienceNeighborHeight*.9)/2+12;
    experienceCards.forEach((card,i)=>{
      const active=i===index,neighbor=i===previous||i===next;
      const direction=i===previous?-1:i===next?1:i<index?-2:2;
      card.style.setProperty('--experience-offset',direction*offset+'px');
      card.classList.toggle('is-experience-active',active);
      card.classList.toggle('is-experience-neighbor',neighbor);
      card.setAttribute('aria-hidden',String(!active));
    });
    const status=$('#experience-progress'),title=experienceCards[index].querySelector('h3').textContent;
    status.textContent=String(index+1).padStart(2,'0')+' / '+String(count).padStart(2,'0');
    status.setAttribute('aria-label','현재 경력 '+(index+1)+' / '+count+', '+title);
  }
  function moveExperience(key) {
    if(!experiencePinned)return false;
    let index=experienceIndex;
    if(key==='ArrowDown'||key==='PageDown')index++;
    else if(key==='ArrowUp'||key==='PageUp')index--;
    else if(key==='Home')index=0;
    else if(key==='End')index=experienceCards.length-1;
    else return false;
    index=Math.max(0,Math.min(experienceCards.length-1,index));
    const start=$('#experience-pin').getBoundingClientRect().top+scrollY-experiencePinTop;
    window.scrollTo({top:start+index*experienceStep+1,behavior:'smooth'});
    return true;
  }
  // PROJECT FIT: 화면 높이와 첫 줄 본문 높이를 측정해 사진 영역만 추가로 맞춥니다.
  function fitProjectPreview() {
    const section=$('#project'),grid=$('#project-grid');
    if(!section||!grid)return;
    section.style.removeProperty('--project-cover-height');
    if(innerWidth<1069)return;
    const firstRow=[...grid.querySelectorAll('[data-project]')].filter(card=>!card.hidden).slice(0,4);
    if(!firstRow.length)return;
    const navHeight=$('.site-header').getBoundingClientRect().height;
    const prefix=grid.getBoundingClientRect().top-section.getBoundingClientRect().top;
    const available=innerHeight-navHeight-24-prefix-12;
    const bodyHeight=Math.max(...firstRow.map(card=>card.querySelector('.project-body').offsetHeight));
    const photoHeight=Math.max(48,Math.min(140,Math.floor(available-bodyHeight-2)));
    section.style.setProperty('--project-cover-height',photoHeight+'px');
  }

  // FILTER: 유형은 하나만 선택하며 Project와 Skills의 선택 상태는 독립적입니다.
  function applyFilters(group) {
    const records=group==='project'?data.projects:data.skills;
    const chosen=selected[group],key=group==='project'?'project':'skill';
    let count=0;
    $$(`[data-${key}]`).forEach(card=>{
      const item=records.find(r=>r.id===card.dataset[key]);
      const show=chosen==='all'||item.typeIds.includes(chosen);
      const wasHidden=card.hidden;
      card.hidden=!show;
      if(!show)card.classList.remove('is-visible');
      if(show) {
        count++;
        if(wasHidden&&observer) {
          card.classList.remove('is-visible','reveal-from-above');
          // 필터로 다시 표시된 카드도 새 진입 알림을 받아 떠오르게 합니다.
          observer.unobserve(card);
          observer.observe(card);
        }
      }
    });
    $$(`[data-filter-group="${group}"][aria-pressed]`).forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.type===chosen)));
    $(`#${group}-results`).textContent=group==='project'?`${count} / ${records.length}개의 프로젝트`:`${count} / ${records.length}개 스킬 표시 중`;
    $(`#${group}-empty`).hidden=count>0;
    prepareReveal();
    if(group==='project')fitProjectPreview();
  }
  function toggleFilter(btn){const group=btn.dataset.filterGroup,type=btn.dataset.type;selected[group]=type;applyFilters(group);
    const active=document.activeElement;if(active?.closest('[hidden]')){const button=$(`.filter-bar [data-filter-group="${group}"][data-type="${type}"]`);button?.focus({preventScroll:true});}
    const section=$(group==='project'?'#project':'#skills');if(section.getBoundingClientRect().bottom<100)section.scrollIntoView({block:'start',behavior:'instant'});
  }
  // OVERLAY: 한 dialog만 사용합니다. 배경 inert·스크롤·열기 버튼 포커스를 공통으로 복원합니다.
  function lockScroll(){lockedY=scrollY;document.body.style.position='fixed';document.body.style.top=`-${lockedY}px`;document.body.style.width='100%';}
  function unlockScroll(){document.body.style.position='';document.body.style.top='';document.body.style.width='';window.scrollTo({top:lockedY,behavior:'instant'});}
  function openDialog(kind,html,opener=document.activeElement,small=false) {
    if(menuOpen)closeMenu(false);
    if(dialog.open)closeDialog(false);
    dialogOpener=opener;
    dialog.classList.toggle('small',small);
    dialog.classList.toggle('project-dialog',kind==='project');
    $('#dialog-eyebrow').textContent={project:'PROJECT DETAIL',certificate:'CERTIFICATION'}[kind]||'DETAIL';
    $('#dialog-content').innerHTML=html;
    $('#dialog-content').scrollTop=0;
    publicSite.inert=true;
    document.body.classList.add('overlay-open');
    lockScroll();
    dialog.showModal();
    prepareImages(dialog);
    (dialog.querySelector('h2')||dialog.querySelector('[data-close]'))?.focus({preventScroll:true});
  }
  function closeDialog(restore=true) {
    if(!dialog.open)return;
    dialog.querySelectorAll('video').forEach(video=>video.pause());
    dialog.close();
    publicSite.inert=false;
    document.body.classList.remove('overlay-open');
    unlockScroll();
    if(restore&&dialogOpener?.isConnected)dialogOpener.focus({preventScroll:true});
  }
  // PROJECT_DETAIL: 텍스트와 원본 비율의 사진 목록을 좌우 패널에 배치합니다.
  function openProject(id,opener) {
    const project=data.projects.find(item=>item.id===id);
    if(!project)return;
    const evidence=(project.evidenceLinks||[]).filter(link=>isSafeExternal(link.url));
    const links=evidence.length?`<section class="evidence-list"><h3>근거 자료</h3><ul>${evidence.map(link=>`<li><a href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.title)} ↗</a></li>`).join('')}</ul></section>`:'';
    const text=`<h2 id="dialog-title" tabindex="-1">${escapeHTML(project.title)}</h2>${project.englishTitle?`<p lang="en" class="muted">${escapeHTML(project.englishTitle)}</p>`:''}${tags(project,data.projectTypes,'project',false)}<div class="project-meta"><p><b>기간</b>${escapeHTML(project.period)}</p><p><b>역할</b>${escapeHTML(project.role)}</p></div>${project.englishSummary?`<p lang="en" class="muted">${escapeHTML(project.englishSummary)}</p>`:''}${detailSections(project)}${links}`;
    openDialog('project',`<div class="project-detail-layout"><section class="project-text-panel" aria-label="프로젝트 설명">${text}</section><section class="project-media-panel" aria-label="프로젝트 사진과 영상"><div id="project-gallery" class="project-gallery">${renderProjectGallery(project)}</div></section></div>`,opener);
    // 음소거 자동 재생 요청이 제한되더라도 사용자가 재생 버튼으로 볼 수 있습니다.
    dialog.querySelectorAll('video[autoplay]').forEach(video=>{
      video.muted=true;
      video.defaultMuted=true;
      video.loop=true;
      video.play()?.catch(()=>{});
    });
  }
  function renderProjectGallery(project) {
    return project.photoIds.map((id,index)=>{
      const asset=data.assets.find(item=>item.id===id);
      if(!asset?.url||!safeAssetURL(asset.url))return '';
      return `<figure class="project-media-item">${media(data,id,{eager:index===0})}</figure>`;
    }).join('')||'<p class="muted">프로젝트 사진 준비 중</p>';
  }
  function openCertificate(id,opener){const c=data.certifications.find(c=>c.id===id);if(c)openDialog('certificate',`<h2 id="dialog-title" tabindex="-1">${escapeHTML(c.title)}</h2><p class="period">${escapeHTML(c.issuer)}</p><p class="certificate-description">${escapeHTML(c.description)}</p><button class="button" type="button" data-close>닫기</button>`,opener,true);}
  // HEADER: 일정 거리 아래로 내려가면 숨기고, 위로 올리거나 메뉴·키보드를 쓰면 복원합니다.
  let headerLastY=Math.max(0,scrollY),headerTravel=0,headerDirection=0;
  function setHeaderHidden(hidden) {
    const header=$('.site-header');
    if(!header)return;
    header.classList.toggle('is-scroll-hidden',hidden);
    header.inert=hidden;
  }
  function showHeader() {
    setHeaderHidden(false);
    headerLastY=Math.max(0,scrollY);headerTravel=0;headerDirection=0;
  }
  function updateHeaderVisibility() {
    const header=$('.site-header');
    if(!header)return;
    const y=Math.max(0,scrollY),delta=y-headerLastY;
    headerLastY=y;
    if(menuOpen||dialog.open||y<=16||header.contains(document.activeElement)) {showHeader();return;}
    if(Math.abs(delta)<1)return;
    const direction=delta>0?1:-1;
    if(direction!==headerDirection) {headerDirection=direction;headerTravel=0;}
    headerTravel+=delta;
    if(direction>0&&headerTravel>=12&&y>header.offsetHeight+24)setHeaderHidden(true);
    else if(direction<0&&headerTravel<=-8)setHeaderHidden(false);
  }

  // MOBILE_MENU: 헤더 안에 메뉴를 유지하고 공개 본문·Footer·빠른 버튼만 비활성화합니다.
  function openMenu(){showHeader();menuOpen=true;$('#main-nav').classList.add('open');$('[data-menu]').setAttribute('aria-expanded','true');$('[data-menu]').setAttribute('aria-label','메뉴 닫기');document.body.classList.add('menu-open');$('#main-content').inert=true;$('.site-footer').inert=true;$('.quick-actions').inert=true;lockScroll();}
  function closeMenu(restore=true){if(!menuOpen)return;menuOpen=false;$('#main-nav').classList.remove('open');$('[data-menu]').setAttribute('aria-expanded','false');$('[data-menu]').setAttribute('aria-label','메뉴 열기');document.body.classList.remove('menu-open');$('#main-content').inert=false;$('.site-footer').inert=false;$('.quick-actions').inert=false;unlockScroll();if(restore)$('[data-menu]').focus({preventScroll:true});}
  // SCROLL: 앵커 이동에만 방문 기록·포커스를 추가합니다. 일반 스크롤은 활성 메뉴만 갱신합니다.
  let scrollFrame=0,scrollCancelled=false;
  function scrollToAnchor(id){const target=document.getElementById(id);if(!target)return;if(menuOpen)closeMenu(false);cancelAnimationFrame(scrollFrame);scrollCancelled=false;showHeader();const start=scrollY,navHeight=$('.site-header').getBoundingClientRect().height,end=id==='home'?0:target.getBoundingClientRect().top+start-navHeight-24;
    history.pushState(null,'','#'+id);const focusTarget=target.querySelector('h1,h2');const complete=()=>{if(!scrollCancelled)focusTarget?.focus({preventScroll:true});};
    if(reduced.matches){window.scrollTo({top:end,behavior:'instant'});complete();return;}const started=performance.now();function frame(now){if(scrollCancelled)return;const t=Math.min((now-started)/650,1),ease=1-Math.pow(1-t,3);window.scrollTo({top:start+(end-start)*ease,behavior:'instant'});if(t<1)scrollFrame=requestAnimationFrame(frame);else complete();}scrollFrame=requestAnimationFrame(frame);
  }
  ['wheel','touchstart'].forEach(name=>window.addEventListener(name,()=>{scrollCancelled=true;cancelAnimationFrame(scrollFrame);},{passive:true}));
  let scrollPending=false;
  function updateActive(){scrollPending=false;updateHeaderVisibility();const threshold=($('.site-header')?.getBoundingClientRect().height||76)+45;let active='';for(const n of data.navigation){const rect=document.getElementById(n.id)?.getBoundingClientRect();if(rect&&rect.top<=threshold&&rect.bottom>threshold)active=n.id;}
    $$('.nav-links a').forEach(a=>{if(a.hash==='#'+active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});updateLearningScroll();updateCompetencies();updateExperience();}
  window.addEventListener('scroll',()=>{if(!scrollPending){scrollPending=true;requestAnimationFrame(updateActive);}},{passive:true});
  // EDUCATION: 아이패드는 sticky로 고정하고 페이지 스크롤을 내부 사진 레일에 연결합니다.
  let learningSlides=[],learningIndex=0,learningPinned=false,learningDistance=0,learningPinTop=0,learningTravel=0;
  function prepareLearning() {
    const box=$('#learning-gallery');
    // 모바일 브라우저 높이가 바뀌어도 긴 사진을 읽던 위치를 유지합니다.
    const oldScreen=$('#learning-screen');
    const manualProgress=!learningPinned&&oldScreen&&learningTravel>0?Math.max(0,Math.min(1,oldScreen.scrollTop/learningTravel)):null;
    learningSlides=visible(data.education.slides).filter(s=>data.assets.some(a=>a.id===s.assetId&&safeAssetURL(a.url)));
    if(!learningSlides.length)return;
    box.querySelectorAll('[data-reveal]').forEach(el=>observer?.unobserve(el));
    learningIndex=Math.min(learningIndex,learningSlides.length-1);
    const navHeight=$('.site-header').getBoundingClientRect().height;
    const stageHeight=Math.max(320,innerHeight-navHeight-32);
    const narrow=innerWidth<900,padding=innerWidth<768?16:26;
    const availableWidth=narrow?box.clientWidth:(box.clientWidth-48)*.675;
    let tabletWidth=Math.max(140,Math.min(availableWidth,(stageHeight-(narrow?240:100))*4/3+padding));
    learningPinTop=navHeight+16;
    learningPinned=learningSlides.length>1&&innerHeight>=580&&!reduced.matches;
    learningDistance=0;
    box.style.setProperty('--pin-top',learningPinTop+'px');
    box.style.setProperty('--pin-height',stageHeight+'px');
    box.style.setProperty('--pin-distance',learningDistance+'px');
    box.style.setProperty('--tablet-width',tabletWidth+'px');
    box.classList.toggle('is-pinned',learningPinned);
    const rail=learningSlides.map((s,i)=>`<figure class="learning-slide${s.screenFit==='width'?' learning-slide-width':''}" data-learning-slide="${i}" aria-label="${i+1} / ${learningSlides.length}: ${escapeHTML(s.title)}">${media(data,s.assetId,{eager:i===0})}</figure>`).join('');
    box.innerHTML=`<div class="learning-stage"><div class="learning-copy" data-reveal><p class="eyebrow">LEARNING ARCHIVE</p><h3>학습 기록</h3><p id="learning-title" class="learning-title"></p><p id="learning-description" class="muted"></p></div><div class="tablet-wrap"><div class="tablet" data-reveal><div id="learning-screen" class="learning-viewport"><div id="learning-rail" class="learning-rail">${rail}</div></div></div>${learningSlides.length>1?'<div class="gallery-controls" data-reveal><button class="icon-button" type="button" data-learning-step="-1" aria-label="이전 학습 이미지">←</button><span id="learning-count" aria-live="polite"></span><button class="icon-button" type="button" data-learning-step="1" aria-label="다음 학습 이미지">→</button></div>':''}</div></div>`;
    // 좁은 화면에서는 사진이 작아지거나 설명이 잘리지 않도록 실제 남은 높이를 확인합니다.
    const stage=box.querySelector('.learning-stage');
    if(narrow&&learningPinned) {
      const copy=box.querySelector('.learning-copy'),controls=box.querySelector('.gallery-controls');
      const style=getComputedStyle(stage),gap=parseFloat(style.rowGap)||16;
      const controlStyle=controls?getComputedStyle(controls):null;
      const controlsHeight=controls?controls.offsetHeight+(parseFloat(controlStyle.marginTop)||0):0;
      const widthFromHeight=(stageHeight-copy.offsetHeight-controlsHeight-gap-padding)*4/3+padding;
      if(widthFromHeight<Math.min(220,availableWidth)) {learningPinned=false;box.classList.remove('is-pinned');}
      else tabletWidth=Math.min(availableWidth,widthFromHeight);
    }
    if(!learningPinned&&narrow)tabletWidth=availableWidth;
    box.style.setProperty('--tablet-width',Math.max(1,tabletWidth)+'px');
    // 사진의 원본 비율로 예약된 높이를 사용해 긴 6·7번 사진의 끝까지 이동합니다.
    const screen=$('#learning-screen'),railElement=$('#learning-rail');
    learningTravel=Math.max(0,railElement.scrollHeight-screen.clientHeight);
    learningDistance=screen.clientHeight?learningTravel/screen.clientHeight*Math.max(innerHeight*.75,400):0;
    box.style.setProperty('--pin-distance',learningDistance+'px');
    prepareImages(box);
    if(learningPinned)updateLearningScroll();
    else if(manualProgress!==null) {
      const offset=manualProgress*learningTravel;
      setLearning(learningIndexAt(offset),false);
      screen.scrollTo({top:offset,behavior:'instant'});
    } else setLearning(learningIndex);
    // 일반 스크롤 환경에서도 화면에 보이는 사진에 맞춰 설명과 번호를 갱신합니다.
    if(!learningPinned)screen.addEventListener('scroll',()=>setLearning(learningIndexAt(screen.scrollTop),false),{passive:true});
    prepareReveal(box);
  }
  // 화면 중심에 보이는 사진의 순번을 찾습니다. 세로로 긴 사진도 같은 제목을 유지합니다.
  function learningIndexAt(offset) {
    const center=offset+$('#learning-screen').clientHeight/2;
    const figures=$$('.learning-slide');
    const found=figures.findIndex(figure=>center<figure.offsetTop+figure.offsetHeight);
    return found<0?learningSlides.length-1:found;
  }
  function learningOffsetAt(index) {
    const figure=$$('.learning-slide')[index];
    return Math.max(0,Math.min(learningTravel,figure?.offsetTop||0));
  }
  // 페이지 진행률을 사진 전체 높이에 연결해 6·7번의 아래쪽까지 읽을 수 있습니다.
  function updateLearningScroll() {
    if(!learningPinned||!learningDistance)return;
    const box=$('#learning-gallery');
    const progress=Math.max(0,Math.min(1,(learningPinTop-box.getBoundingClientRect().top)/learningDistance));
    const offset=progress*learningTravel,rail=$('#learning-rail');
    if(rail)rail.style.transform=`translateY(${-offset}px)`;
    setLearning(learningIndexAt(offset),false);
  }
  function setLearning(index,moveRail=true) {
    const slide=learningSlides[index];
    if(!slide)return;
    if(index===learningIndex&&!moveRail&&$('#learning-description').textContent===slide.description)return;
    learningIndex=index;
    if(moveRail) {
      const offset=learningOffsetAt(index),rail=$('#learning-rail'),screen=$('#learning-screen');
      if(learningPinned)rail.style.transform=`translateY(${-offset}px)`;
      else {rail.style.transform='';screen.scrollTo({top:offset,behavior:'instant'});}
    }
    $('#learning-title').textContent=slide.title;
    $('#learning-description').textContent=slide.description;
    if($('#learning-count')) {
      $('#learning-count').textContent=`${String(index+1).padStart(2,'0')} / ${String(learningSlides.length).padStart(2,'0')}`;
      $('[data-learning-step="-1"]').disabled=index===0;
      $('[data-learning-step="1"]').disabled=index===learningSlides.length-1;
    }
    $$('.learning-slide').forEach((el,i)=>{
      el.setAttribute('aria-hidden',String(i!==index));
      // 다음 이미지도 미리 읽어 스크롤 도중 빈 화면이 생기지 않게 합니다.
      if(Math.abs(i-index)<=1)el.querySelector('img')?.setAttribute('loading','eager');
    });
  }
  function stepLearning(direction) {
    const index=Math.max(0,Math.min(learningSlides.length-1,learningIndex+direction));
    if(!learningPinned){setLearning(index);return;}
    const box=$('#learning-gallery');
    const start=box.getBoundingClientRect().top+scrollY-learningPinTop;
    window.scrollTo({top:start+(learningTravel?learningOffsetAt(index)/learningTravel:0)*learningDistance,behavior:reduced.matches?'instant':'smooth'});
  }
  function initializePublic(){document.body.classList.add('js-ready');prepareImages(publicSite);prepareCompetencies();prepareExperience();prepareReveal();applyFilters('project');applyFilters('skill');prepareLearning();updateActive();if(location.hash)setTimeout(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView(),50);}
  // 고정 경력 구간은 키보드로도 같은 순서로 이동할 수 있습니다.
  $('#experience-viewport')?.addEventListener('keydown',event=>{if(moveExperience(event.key))event.preventDefault();});
  // EVENTS: 태그·메뉴·갤러리·팝업 버튼의 클릭을 한 번만 위임합니다.
  document.addEventListener('click',event=>{
    const target=event.target.closest('button,a');
    if(target?.matches('[data-close]')){closeDialog();return;}
    if(target?.matches('[data-menu]')){menuOpen?closeMenu():openMenu();return;}
    if(menuOpen&&!event.target.closest('.site-header'))closeMenu(false);
    if(target?.matches('[data-filter-group]')){toggleFilter(target);return;}
    if(target?.matches('[data-certificate]')){openCertificate(target.dataset.certificate,target);return;}
    if(target?.matches('[data-open-project]')){event.preventDefault();openProject(target.dataset.openProject,target);return;}
    if(target?.matches('[data-learning-step]')){stepLearning(Number(target.dataset.learningStep));return;}
    if(target?.matches('a[href^="#"]')){const id=target.hash.slice(1);if(document.getElementById(id)){event.preventDefault();scrollToAnchor(id);}return;}
    if(!target&&event.target.closest('[data-project]')&&!event.target.closest('details')){const card=event.target.closest('[data-project]');openProject(card.dataset.project,card.querySelector('[data-open-project]'));return;}
  });
  let downOutside=false;dialog.addEventListener('pointerdown',e=>downOutside=e.target===dialog);dialog.addEventListener('pointerup',e=>{if(downOutside&&e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)closeDialog();}downOutside=false;});
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
  document.addEventListener('keydown',event=>{if(event.key==='Tab')showHeader();if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)){scrollCancelled=true;cancelAnimationFrame(scrollFrame);}if(event.key==='Escape'&&menuOpen){event.preventDefault();closeMenu();}
    if(event.key==='Tab'&&(dialog.open||menuOpen)){const scope=dialog.open?dialog:$('.site-header');const focusables=[...scope.querySelectorAll('a[href],button:not(:disabled),[tabindex="0"],video[controls]')].filter(el=>!el.hidden&&el.getClientRects().length);const first=focusables[0],last=focusables.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
  document.addEventListener('focusin',event=>{event.target.closest('.reveal-pending')?.classList.add('is-visible');});
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(menuOpen&&innerWidth>=834)closeMenu(false);prepareCompetencies();prepareExperience();prepareReveal();prepareLearning();fitProjectPreview();showHeader();},180);});
  reduced.addEventListener('change',()=>{prepareCompetencies();prepareExperience();prepareReveal();prepareLearning();fitProjectPreview();});
  // 인쇄 직전에 상세를 펼치고 인쇄 후 원래 열린 상태로 되돌립니다.
  let printDetails=[];window.addEventListener('beforeprint',()=>{printDetails=$$('.static-detail').map(el=>({el,open:el.open}));printDetails.forEach(({el})=>el.open=true);});window.addEventListener('afterprint',()=>printDetails.forEach(({el,open})=>el.open=open));
  // 정적 HTML이 준비되면 공개 화면의 상호작용을 초기화합니다.
  initializePublic();
})();
