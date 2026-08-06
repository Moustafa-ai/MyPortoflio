        const SUPABASE_URL = "https://qrfvrcfnlebqyaqssydf.supabase.co";
        const SUPABASE_ANON_KEY = "sb_publishable_9NbM6RL1seyQwnhrgJCxEw_JpdAuf8Y";

        let supabaseClient = null;
let pendingPostId = null;
        const supabaseConfigured = SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20;
        if (supabaseConfigured && window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }

        // ---------------- Silent visit counter (no UI, just logs a row) ----------------
        if (supabaseClient) {
            (async () => {
                let country = null, country_code = null;
                try {
                    const geoRes = await fetch('https://get.geojs.io/v1/ip/geo.json');
                    if (geoRes.ok) {
                        const geo = await geoRes.json();
                        country = geo.country || null;
                        country_code = geo.country_code || null;
                        City = geo.city || null;
                        locip = geo.ip || null;
                    }
                } catch (e) { /* geo lookup failed, log the visit without country */ }
                const { error } = await supabaseClient.from('site_visits').insert({ country, country_code, City, locip });
                if (error) console.warn('Visit log skipped:', error.message);
            })();
        }

        // ---------------- Fallback seed data (shown until Supabase is connected) ----------------
        const seedProjects = [];

        const catColors = {
            "Interactive Web Maps": "#e6a53c",
            "Digitization & Georeferencing": "#6fae8f",
            "Spatial Analysis": "#f0c274",
            "Data Conversion": "#8fb3c9",
            "Cartography & Planning": "#c98f8f",
            "Data Processing": "#a3c98f"
        };

        const grid = document.getElementById('projectGrid');
        const countEl = document.getElementById('projectCount');
        const pinSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>';

        let allProjects = seedProjects;

        function yearKey(y) {
            const present = /present/i.test(y || '');
            const nums = ((y || '').match(/\d{4}/g) || ['0']).map(Number);
            return {
                present,
                maxY: Math.max(...nums),
                minY: Math.min(...nums)
            };
        }

        function escapeHtml(str) {
            return (str || '').replace(/[&<>"']/g, m => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[m]));
        }

        function renderProjects(filter) {
            const list = (filter === 'all' ? allProjects.slice() : allProjects.filter(p => p.category === filter));
            list.sort((a, b) => {
                const ka = yearKey(a.year),
                    kb = yearKey(b.year);
                if (ka.present !== kb.present) return (kb.present ? 1 : 0) - (ka.present ? 1 : 0);
                if (kb.maxY !== ka.maxY) return kb.maxY - ka.maxY;
                return kb.minY - ka.minY;
            });
            grid.innerHTML = list.map((p, i) => `
    <div class="project-card" data-cat="${escapeHtml(p.category)}" data-idx="${i}">
      <div class="project-thumb" ${p.image_url ? `style="background-image:url('${escapeHtml(p.image_url)}'); background-size:cover; background-position:center;"` : ''}>
        ${p.image_url ? '' : pinSVG + '<span>Add project image</span>'}
      </div>
      <div class="project-body">
        <div class="project-top">
          <div class="project-title">${escapeHtml(p.title)}</div>
          <div class="project-year">${escapeHtml(p.year)}</div>
        </div>
        ${p.client && p.client !== '—' ? `<div class="project-client">${escapeHtml(p.client)}</div>` : ''}
        <div class="project-desc">${escapeHtml(p.description)}</div>
        <div class="project-cat" style="color:${catColors[p.category] || '#8fb3c9'}; border-color:${catColors[p.category] || '#8fb3c9'}">${escapeHtml(p.category)}</div>
      </div>
    </div>
  `).join('');
  countEl.textContent = `Showing ${list.length} of ${allProjects.length} projects`;
  const statProjectsEl = document.getElementById('statProjectsDelivered');
  if (statProjectsEl) statProjectsEl.textContent = `${allProjects.length}+`;
  currentList = list;
  grid.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', () => openLightbox(currentList[Number(card.dataset.idx)]));
  });
}
let currentList = [];

async function loadProjects(){
  if(!supabaseClient){
    renderProjects('all'); // fall back to seed data, unconfigured
    return;
  }
  const { data, error } = await supabaseClient
    .from('projects')
    .select('*')
    .order('year_sort', { ascending:false });
  if(error || !data || data.length === 0){
    console.warn('Supabase projects fetch failed or empty, using seed data.', error);
    allProjects = seedProjects;
  } else {
    allProjects = data;
  }
  renderProjects('all');
}
loadProjects();

// ---------------- Experience (timeline) ----------------
const seedExperience = [];

function escapeHtmlText(str){
  return (str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function renderExperience(list){
  const timelineEl = document.getElementById('experienceTimeline');
  if(!timelineEl) return;
  timelineEl.innerHTML = list.map(x => `
    <div class="tl-item${x.is_current ? ' current' : ''}">
        <div class="tl-head">
            <div>
                <div class="tl-role">${escapeHtmlText(x.role)}</div>
                <div class="tl-org">${escapeHtmlText(x.org || '—')}</div>
            </div>
            <div class="tl-meta">${escapeHtmlText(x.date_range)}${x.location ? '<br>' + escapeHtmlText(x.location) : ''}</div>
        </div>
        <p class="tl-desc">${escapeHtmlText(x.description)}</p>
    </div>
  `).join('');
}

async function loadExperience(){
  if(!supabaseClient){
    renderExperience(seedExperience); // fall back to seed data, unconfigured
    return;
  }
  const { data, error } = await supabaseClient
    .from('experience')
    .select('*')
    .order('sort_order', { ascending:true });
  if(error || !data || data.length === 0){
    console.warn('Supabase experience fetch failed or empty, using seed data.', error);
    renderExperience(seedExperience);
  } else {
    renderExperience(data);
  }
}
loadExperience();

document.getElementById('filters').addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if(!btn) return;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderProjects(btn.dataset.filter);
});

// ---------------- Lightbox gallery ----------------
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');
const lbNoImg = document.getElementById('lbNoImg');
const lbThumbs = document.getElementById('lbThumbs');
const lbTitle = document.getElementById('lbTitle');
const lbYear = document.getElementById('lbYear');
const lbClient = document.getElementById('lbClient');
const lbDesc = document.getElementById('lbDesc');
const lbCat = document.getElementById('lbCat');
const lbPrev = document.getElementById('lbPrev');
const lbNext = document.getElementById('lbNext');

let lbImages = [];
let lbIndex = 0;

function openLightbox(p){
  if(!p) return;
  lbImages = (p.images && p.images.length) ? p.images : (p.image_url ? [p.image_url] : []);
  lbIndex = 0;
  lbTitle.textContent = p.title || '';
  lbYear.textContent = p.year || '';
  lbClient.textContent = (p.client && p.client !== '—') ? p.client : '';
  lbDesc.textContent = p.description || '';
  lbCat.textContent = p.category || '';
  const color = catColors[p.category] || '#8fb3c9';
  lbCat.style.color = color; lbCat.style.borderColor = color;

  renderLbThumbs();
  showLbImage();
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderLbThumbs(){
  if(lbImages.length < 2){ lbThumbs.innerHTML = ''; lbThumbs.style.display = 'none'; return; }
  lbThumbs.style.display = 'flex';
  lbThumbs.innerHTML = lbImages.map((url, i) => `<img src="${escapeHtml(url)}" class="${i === lbIndex ? 'active' : ''}" data-i="${i}">`).join('');
  lbThumbs.querySelectorAll('img').forEach(img => {
    img.addEventListener('click', () => { lbIndex = Number(img.dataset.i); showLbImage(); });
  });
}

function showLbImage(){
  if(lbImages.length === 0){
    lbImg.style.display = 'none';
    lbNoImg.style.display = 'flex';
  } else {
    lbImg.src = lbImages[lbIndex];
    lbImg.style.display = 'block';
    lbNoImg.style.display = 'none';
  }
  lbPrev.style.display = lbImages.length > 1 ? 'flex' : 'none';
  lbNext.style.display = lbImages.length > 1 ? 'flex' : 'none';
  lbThumbs.querySelectorAll('img').forEach((img,i) => img.classList.toggle('active', i === lbIndex));
}

function closeLightbox(){
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

lbPrev.addEventListener('click', () => { lbIndex = (lbIndex - 1 + lbImages.length) % lbImages.length; showLbImage(); });
lbNext.addEventListener('click', () => { lbIndex = (lbIndex + 1) % lbImages.length; showLbImage(); });
document.getElementById('lbClose').addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => { if(e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', (e) => {
  if(!lightbox.classList.contains('open')) return;
  if(e.key === 'Escape') closeLightbox();
  if(e.key === 'ArrowLeft') lbPrev.click();
  if(e.key === 'ArrowRight') lbNext.click();
});

// ---------------- Page router (tabs) ----------------
const pages = document.querySelectorAll('.page');
const tabBtns = document.querySelectorAll('.tab-btn');
const sbSection = document.getElementById('sbSection');

function goTo(id, updateHash){
  pages.forEach(p => p.classList.toggle('active', p.id === 'page-' + id));
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.goto === id));
  document.querySelectorAll('.terrain-layer').forEach(g => g.classList.toggle('active', g.dataset.page === id));
  sbSection.textContent = `Page: ${id}`;
  if(updateHash !== false) history.replaceState(null, '', '#' + id);
  window.scrollTo({top:0, behavior:'instant' in document.documentElement.style ? 'instant' : 'auto'});
}

document.querySelectorAll('[data-goto]').forEach(el => {
  el.addEventListener('click', () => goTo(el.dataset.goto));
});

const rawHash = (location.hash || '#home').replace('#','');
if(rawHash.startsWith('blog/')){
  pendingPostId = rawHash.slice('blog/'.length);
  goTo('blog', false);
} else {
  goTo(['home','profile','experience','projects','skills','services','blog','contact'].includes(rawHash) ? rawHash : 'home', false);
}

// ---------------- Status bar coordinate readout ----------------
const sbCoord = document.getElementById('sbCoord');
window.addEventListener('mousemove', (e) => {
  const lon = (29.85 + (e.clientX / window.innerWidth) * (29.98 - 29.85)).toFixed(4);
  const lat = (31.25 - (e.clientY / window.innerHeight) * (31.25 - 31.15)).toFixed(4);
  sbCoord.textContent = `X ${lon}, Y ${lat}`;
});
// ---------------- Contact form (EmailJS — sends instantly) ----------------
const EMAILJS_SERVICE_ID = "service_gdflkik";
const EMAILJS_TEMPLATE_ID = "template_nn7ieui";
const EMAILJS_PUBLIC_KEY = "1XFc89_W8WBytdXKV";
const emailjsConfigured = !EMAILJS_SERVICE_ID.startsWith("YOUR_") && !EMAILJS_TEMPLATE_ID.startsWith("YOUR_") && !EMAILJS_PUBLIC_KEY.startsWith("YOUR_");
if(emailjsConfigured && window.emailjs){
  window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

const msgForm = document.getElementById('msgForm');
const msgFormMsg = document.getElementById('msgFormStatus');
const msgSendBtn = document.getElementById('msgSendBtn');

if(msgForm){
  msgForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('msgName').value.trim();
    const email = document.getElementById('msgEmail').value.trim();
    const subject = document.getElementById('msgSubject').value.trim() || 'Project inquiry';
    const body = document.getElementById('msgBody').value.trim();

    if(!emailjsConfigured){
      // fallback: open mail client if EmailJS isn't set up yet
      const fullBody = `${body}\n\n—\n${name}\n${email}`;
      window.location.href = `mailto:sir.moustafa.awad@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`;
      return;
    }

    msgSendBtn.disabled = true; msgSendBtn.textContent = 'Sending…';
    if(msgFormMsg){ msgFormMsg.className = 'msg'; }
    const sentAt = new Date().toLocaleString('en-GB', {
      day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
    });
    try{
      await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        from_name: name,
        from_email: email,
        subject: subject,
        message: body,
        sent_at: sentAt
      });
      if(msgFormMsg){ msgFormMsg.textContent = `Message sent on ${sentAt} — thank you! I'll get back to you soon.`; msgFormMsg.className = 'msg show ok'; }
      msgForm.reset();
    } catch(err){
      if(msgFormMsg){ msgFormMsg.textContent = 'Could not send the message. Please try again or email directly.'; msgFormMsg.className = 'msg show err'; }
    } finally {
      msgSendBtn.disabled = false; msgSendBtn.textContent = 'Send message →';
    }
  });
}

// ---------------- Request a service (Services page) ----------------
const servicesByCategory = {
  Basic: [
    'Data digitization & georeferencing from scanned maps or CAD files',
    'Shapefile & GeoJSON format conversion',
    'Basic map creation & cartographic layouts',
    'Coordinate system transformation & reprojection',
    'Geodatabase setup & file organization',
    'GIS data cleaning & quality checks'
  ],
  Advanced: [
    'Spatial analysis — buffer, overlay, proximity & network analysis',
    'Interactive web map development with Leaflet & Mapbox GL JS',
    'Custom geodatabase design & schema modeling',
    'Remote sensing & satellite imagery interpretation',
    'Terrain & elevation analysis (DEM, slope, watershed)',
    'GIS dashboards & data visualization'
  ],
  Professional: [
    'End-to-end GIS system design & implementation',
    'Full-stack web GIS application development',
    'Enterprise geodatabase architecture & administration',
    'Spatial data infrastructure (SDI) consulting',
    'GIS workflow automation & Python / ArcPy scripting',
    'Large-scale spatial data migration & integration'
  ]
};

const requestServiceBtn = document.getElementById('requestServiceBtn');
const requestPanel = document.getElementById('requestPanel');
const reqCategory = document.getElementById('reqCategory');
const reqService = document.getElementById('reqService');
const requestForm = document.getElementById('requestForm');
const requestFormMsg = document.getElementById('requestFormStatus');
const reqSendBtn = document.getElementById('reqSendBtn');

if(requestServiceBtn && requestPanel){
  requestServiceBtn.addEventListener('click', () => {
    const opening = requestPanel.style.display === 'none';
    requestPanel.style.display = opening ? 'block' : 'none';
    requestServiceBtn.textContent = opening ? 'Request a service ↑' : 'Request a service ↓';
    if(opening) requestPanel.scrollIntoView({ behavior:'smooth', block:'start' });
  });
}

if(reqCategory && reqService){
  reqCategory.addEventListener('change', () => {
    const list = servicesByCategory[reqCategory.value];
    if(!list){
      reqService.innerHTML = '<option value="">Choose a category first…</option>';
      reqService.disabled = true;
      return;
    }
    reqService.disabled = false;
    reqService.innerHTML = '<option value="">Choose a service…</option>' +
      list.map(s => `<option value="${s.replace(/"/g,'&quot;')}">${s}</option>`).join('');
  });
}

if(requestForm){
  requestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reqName').value.trim();
    const email = document.getElementById('reqEmail').value.trim();
    const category = reqCategory.value;
    const service = reqService.value;
    const details = document.getElementById('reqDetails').value.trim();
    const budget = document.getElementById('reqBudget').value.trim() || 'Not specified';
    const sentAt = new Date().toLocaleString('en-GB', {
      day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
    });
    const subject = `Service request: ${category} — ${service}`;
    const body = `Category: ${category}\nService: ${service}\n\nRequest details:\n${details}\n\nEstimated budget: ${budget}\nRequest date: ${sentAt}`;

    if(!emailjsConfigured){
      const fullBody = `${body}\n\n—\n${name}\n${email}`;
      window.location.href = `mailto:sir.moustafa.awad@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`;
      return;
    }

    reqSendBtn.disabled = true; reqSendBtn.textContent = 'Sending…';
    if(requestFormMsg){ requestFormMsg.className = 'msg'; }
    try{
      await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        from_name: name,
        from_email: email,
        subject: subject,
        message: body,
        sent_at: sentAt
      });
      if(requestFormMsg){ requestFormMsg.textContent = `Request sent on ${sentAt} — thank you! I'll get back to you soon.`; requestFormMsg.className = 'msg show ok'; }
      requestForm.reset();
      reqService.innerHTML = '<option value="">Choose a category first…</option>';
      reqService.disabled = true;
    } catch(err){
      if(requestFormMsg){ requestFormMsg.textContent = 'Could not send the request. Please try again or email directly.'; requestFormMsg.className = 'msg show err'; }
    } finally {
      reqSendBtn.disabled = false; reqSendBtn.textContent = 'Send request →';
    }
  });
}

// ---------------- Blog (articles & videos) ----------------
function getYouTubeEmbedId(url){
  if(!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

function getYouTubeThumbnail(url){
  const id = getYouTubeEmbedId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

let allBlogPosts = [];

function renderBlogPosts(filter){
  const grid = document.getElementById('blogGrid');
  const countEl = document.getElementById('blogCount');
  if(!grid) return;
  const list = (filter === 'all' ? allBlogPosts.slice() : allBlogPosts.filter(p => p.type === filter));
  countEl.textContent = `Showing ${list.length} of ${allBlogPosts.length} posts`;

  if(list.length === 0){
    grid.innerHTML = '<div class="empty-state">No posts yet — check back soon.</div>';
    return;
  }

  grid.innerHTML = list.map(p => {
    const thumb = p.cover_image || (p.type === 'video' ? getYouTubeThumbnail(p.url) : null);
    const dateStr = p.published_date ? new Date(p.published_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '';
    return `
      <div class="blog-card" data-id="${p.id}" role="button" tabindex="0">
        <div class="blog-thumb${thumb ? '' : ' no-image'}" ${thumb ? `style="background-image:url('${thumb}')"` : ''}>
          ${thumb ? '' : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/></svg>`}
          <span class="blog-type-badge ${p.type}">${p.type === 'video' ? 'Video' : 'Article'}</span>
        </div>
        <div class="blog-body">
          <div class="blog-title">${escapeHtmlText(p.title)}</div>
          ${dateStr ? `<div class="blog-date">${dateStr}</div>` : ''}
          <p class="blog-excerpt">${escapeHtmlText(p.excerpt)}</p>
          <span class="blog-cta">${p.type === 'video' ? 'Watch video →' : 'Read more →'}</span>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.blog-card').forEach(card => {
    card.addEventListener('click', () => openBlogPost(card.dataset.id));
    card.addEventListener('keydown', (e) => { if(e.key === 'Enter') openBlogPost(card.dataset.id); });
  });
}

async function loadBlogPosts(){
  if(!supabaseClient){
    renderBlogPosts('all'); // no seed data — blog starts empty until posts are added
    return;
  }
  const { data, error } = await supabaseClient
    .from('blog_posts')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('published_date', { ascending: false });
  if(error){
    console.warn('Supabase blog fetch failed.', error);
    allBlogPosts = [];
  } else {
    allBlogPosts = data || [];
  }
  renderBlogPosts('all');
  if(pendingPostId){
    const id = pendingPostId;
    pendingPostId = null;
    openBlogPost(id, false);
  }
}
loadBlogPosts();

document.querySelectorAll('#blogFilters .filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#blogFilters .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderBlogPosts(btn.dataset.blogFilter);
  });
});

// ---------------- Single blog post view ----------------
function formatBlogContent(content){
  if(!content) return '';
  // If the admin already wrote HTML (contains a block tag), use it as-is.
  if(/<(p|div|img|br|h[1-6]|ul|ol|blockquote)[\s>]/i.test(content)) return content;
  // Otherwise treat it as plain text and turn blank lines into paragraphs.
  return content.split(/\n\s*\n/).map(para => `<p>${escapeHtmlText(para).replace(/\n/g, '<br>')}</p>`).join('');
}

function renderBlogPostView(post){
  const container = document.getElementById('blogPostContainer');
  if(!container) return;
  const dateStr = post.published_date ? new Date(post.published_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '';
  const ytId = post.type === 'video' ? getYouTubeEmbedId(post.url) : null;

  let mediaHtml = '';
  if(ytId){
    mediaHtml = `<div class="blog-post-video"><iframe src="https://www.youtube-nocookie.com/embed/${ytId}" title="${escapeHtmlText(post.title)}" frameborder="0" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
  } else if(post.type === 'video' && post.url){
    mediaHtml = `<a class="btn" href="${escapeHtmlText(post.url)}" target="_blank" rel="noopener">Watch video →</a>`;
  } else if(post.cover_image){
    mediaHtml = `<img class="blog-post-cover" src="${escapeHtmlText(post.cover_image)}" alt="${escapeHtmlText(post.title)}">`;
  }

  const extraImages = (post.images || '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  const galleryHtml = extraImages.length ? `
    <div class="blog-post-gallery">
      ${extraImages.map(src => `<img src="${escapeHtmlText(src)}" alt="">`).join('')}
    </div>` : '';

  const votedKey = `blogVote_${post.id}`;
  const voted = localStorage.getItem(votedKey);

  container.innerHTML = `
    <span class="blog-type-badge ${post.type}" style="margin:0 0 12px;">${post.type === 'video' ? 'Video' : 'Article'}</span>
    <h2 class="blog-post-title">${escapeHtmlText(post.title)}</h2>
    ${dateStr ? `<div class="blog-date">${dateStr}</div>` : ''}
    ${mediaHtml ? `<div class="blog-post-media">${mediaHtml}</div>` : ''}
    <div class="blog-post-content">${formatBlogContent(post.content) || `<p>${escapeHtmlText(post.excerpt)}</p>`}</div>
    ${post.url && !ytId ? `<p><a href="${escapeHtmlText(post.url)}" target="_blank" rel="noopener" class="blog-cta">External link →</a></p>` : ''}
    ${galleryHtml}

    <div class="blog-reactions">
      <button type="button" class="reaction-btn like-btn" id="blogLikeBtn" ${voted ? 'disabled' : ''}>👍 <span id="blogLikeCount">${post.likes || 0}</span></button>
      <button type="button" class="reaction-btn dislike-btn" id="blogDislikeBtn" ${voted ? 'disabled' : ''}>👎 <span id="blogDislikeCount">${post.dislikes || 0}</span></button>
      <button type="button" class="reaction-btn share-btn" id="blogShareBtn">↗ Share</button>
      <span class="msg" id="blogShareMsg"></span>
    </div>

    <div class="blog-comments">
      <h3>Comments</h3>
      <div id="blogCommentsList" class="comments-list"><div class="empty-state">Loading…</div></div>
      <form id="blogCommentForm" class="comment-form">
        <div class="msg-row">
          <div class="msg-field">
            <label for="cName">Your name</label>
            <input type="text" id="cName" required placeholder="Your name">
          </div>
        </div>
        <div class="msg-field">
          <label for="cText">Comment</label>
          <textarea id="cText" rows="3" required placeholder="Write a comment..."></textarea>
        </div>
        <button type="submit" class="btn">Post comment</button>
        <div class="msg" id="commentFormMsg"></div>
      </form>
    </div>
  `;

  document.getElementById('blogLikeBtn').addEventListener('click', () => voteBlogPost(post, 'like'));
  document.getElementById('blogDislikeBtn').addEventListener('click', () => voteBlogPost(post, 'dislike'));
  document.getElementById('blogShareBtn').addEventListener('click', () => shareBlogPost(post));
  document.getElementById('blogCommentForm').addEventListener('submit', (e) => submitBlogComment(e, post.id));

  loadBlogComments(post.id);
}

async function voteBlogPost(post, kind){
  const votedKey = `blogVote_${post.id}`;
  if(localStorage.getItem(votedKey)) return;
  if(!supabaseClient) return;
  const rpcName = kind === 'like' ? 'increment_blog_like' : 'increment_blog_dislike';
  const { error } = await supabaseClient.rpc(rpcName, { post_id: post.id });
  if(error){ console.warn('Vote failed:', error.message); return; }
  localStorage.setItem(votedKey, kind);
  document.getElementById('blogLikeBtn').disabled = true;
  document.getElementById('blogDislikeBtn').disabled = true;
  const countEl = document.getElementById(kind === 'like' ? 'blogLikeCount' : 'blogDislikeCount');
  countEl.textContent = Number(countEl.textContent) + 1;
}

function shareBlogPost(post){
  const url = `${location.origin}${location.pathname}#blog/${post.id}`;
  const msgEl = document.getElementById('blogShareMsg');
  if(navigator.share){
    navigator.share({ title: post.title, text: post.excerpt, url }).catch(() => {});
    return;
  }
  navigator.clipboard.writeText(url).then(() => {
    if(msgEl){ msgEl.textContent = 'Link copied!'; msgEl.className = 'msg show ok'; setTimeout(() => { msgEl.className = 'msg'; }, 2500); }
  }).catch(() => {
    if(msgEl){ msgEl.textContent = url; msgEl.className = 'msg show'; }
  });
}

async function loadBlogComments(postId){
  const listEl = document.getElementById('blogCommentsList');
  if(!listEl) return;
  if(!supabaseClient){
    listEl.innerHTML = '<div class="empty-state">Comments unavailable.</div>';
    return;
  }
  const { data, error } = await supabaseClient
    .from('blog_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: false });
  if(error){
    listEl.innerHTML = `<div class="empty-state">Could not load comments.</div>`;
    return;
  }
  if(!data || data.length === 0){
    listEl.innerHTML = '<div class="empty-state">No comments yet — be the first!</div>';
    return;
  }
  listEl.innerHTML = data.map(c => `
    <div class="comment-row">
      <div class="comment-head"><span class="comment-name">${escapeHtmlText(c.name)}</span><span class="comment-date">${new Date(c.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</span></div>
      <p class="comment-text">${escapeHtmlText(c.comment)}</p>
    </div>
  `).join('');
}

async function submitBlogComment(e, postId){
  e.preventDefault();
  const name = document.getElementById('cName').value.trim();
  const text = document.getElementById('cText').value.trim();
  const msgEl = document.getElementById('commentFormMsg');
  if(!supabaseClient) return;
  const { error } = await supabaseClient.from('blog_comments').insert({ post_id: postId, name, comment: text });
  if(error){
    if(msgEl){ msgEl.textContent = 'Could not post comment. Try again.'; msgEl.className = 'msg show err'; }
    return;
  }
  if(msgEl){ msgEl.textContent = 'Comment posted!'; msgEl.className = 'msg show ok'; }
  document.getElementById('blogCommentForm').reset();
  loadBlogComments(postId);
}

function openBlogPost(id, updateHash){
  const post = allBlogPosts.find(p => p.id === id);
  if(!post){ pendingPostId = id; return; } // posts not loaded yet — retry once loadBlogPosts finishes
  renderBlogPostView(post);
  pages.forEach(p => p.classList.toggle('active', p.id === 'page-blog-post'));
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.goto === 'blog'));
  document.querySelectorAll('.terrain-layer').forEach(g => g.classList.toggle('active', g.dataset.page === 'services'));
  if(updateHash !== false) history.replaceState(null, '', '#blog/' + id);
  window.scrollTo({top:0, behavior:'auto'});
}

document.getElementById('blogPostBackBtn')?.addEventListener('click', () => goTo('blog'));

