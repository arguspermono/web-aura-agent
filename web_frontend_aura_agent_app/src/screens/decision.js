import { navigate, resetDraftClaim, setCurrentClaim, setCurrentClaimStatus, state } from '../main.js';
import { getClaim, resolveEvidenceUrl } from '../services/api_service.js';

const decisionLabels = {
  AUTO_APPROVE: 'AUTO APPROVED',
  REJECT: 'REJECTED',
  NEEDS_REVIEW: 'NEEDS REVIEW'
};

function formatDecisionLabel(decision) {
  return decisionLabels[decision] || decision.replaceAll('_', ' ');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderDecision() {
  const container = document.createElement('div');
  container.className = 'w-full max-w-md mx-auto md:max-w-4xl flex flex-col pb-8';
  const claim = state.currentClaim;
  const status = claim?.status || 'review';
  const decision = claim?.ai_decision || 'NEEDS_REVIEW';
  const confidence = Math.round((claim?.confidence_score || 0) * 100);
  const refundValue = Number(claim?.refund_value || 0);
  const damageTypeRaw = claim?.damage_type || 'Unknown';
  const damageTypeLabel = damageTypeRaw.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const aiExplanation = claim?.ai_explanation || 'Backend analysis result is not available.';
  const decisionLabel = formatDecisionLabel(decision);
  const claimTypeRaw = claim?.claim_type || 'Unknown';
  const claimTypeLabel = claimTypeRaw.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const submittedDescription = claim?.text_description || state.draftClaim?.textDescription || 'No written description was provided.';
  let evidenceSummary = claim?.file_ids?.[0] || state.draftClaim?.evidencePreviewName || 'Single evidence file attached';
  if (evidenceSummary.length > 30 && evidenceSummary.includes('-')) {
    evidenceSummary = `File: ${evidenceSummary.split('-')[0]}...`;
  }
  // Use evidence_url from the backend (persisted) first, then fall back to the
  // in-session blob URL (only valid in the same browser session after upload).
  const evidencePreviewUrl = claim?.evidence_url || state.draftClaim?.evidencePreviewUrl || '';
  // Always render the placeholder slot — the async resolveEvidenceUrl() will swap it
  // with a blob URL after fetching through the authenticated backend proxy.
  const hasEvidenceImage = false;
  const updatedAtLabel = claim?.updated_at ? new Date(claim.updated_at).toLocaleString('id-ID') : 'Live backend response';

  const statusFormatted = status.charAt(0).toUpperCase() + status.slice(1);
  const decisionTone = decision === 'AUTO_APPROVE'
    ? 'text-[#00C853] border-[#00C853]/40 bg-[#00C853]/10 shadow-[0_0_12px_rgba(0,200,83,0.2)]'
    : decision === 'REJECT'
      ? 'text-error border-error/40 bg-error/10 shadow-[0_0_12px_rgba(186,26,26,0.2)]'
      : 'text-amber-600 border-amber-400/40 bg-amber-100/60 shadow-[0_0_12px_rgba(217,119,6,0.2)]';
  const decisionIcon = decision === 'AUTO_APPROVE' ? 'verified' : decision === 'REJECT' ? 'block' : 'shield';
  const coverageLabel = status === 'approved' ? 'Full' : status === 'review' ? 'Manual Review' : 'Unavailable';
  const coverageTone = status === 'approved' ? 'text-[#00C853]' : status === 'review' ? 'text-amber-600' : 'text-error';
  const ctaLabel = status === 'approved' ? 'Back To Dashboard' : status === 'review' ? 'Return To Dashboard' : 'Create Another Claim';
  
  container.innerHTML = `
    <style>
      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      .animate-shimmer {
        animation: shimmer 2s infinite linear;
      }
      .fade-in-up {
        animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        opacity: 0;
        transform: translateY(20px);
      }
      @keyframes fadeInUp {
        to { opacity: 1; transform: translateY(0); }
      }
      .stagger-1 { animation-delay: 100ms; }
      .stagger-2 { animation-delay: 200ms; }
      .stagger-3 { animation-delay: 300ms; }
      .stagger-4 { animation-delay: 400ms; }
      .stagger-5 { animation-delay: 500ms; }
    </style>

    <!-- Progress Indicator -->
    <div class="flex flex-col gap-base w-full max-w-md mx-auto md:max-w-full fade-in-up">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
        <span class="font-label-caps text-[10px] text-on-surface-variant tracking-[0.2em] uppercase font-bold">Phase 3 of 3</span>
        <span class="font-label-caps text-[10px] text-primary tracking-[0.2em] uppercase font-bold">Final Decision</span>
      </div>
      <div class="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden relative shadow-inner">
        <div class="h-full w-full bg-gradient-to-r from-primary to-[#00C853] relative">
          <div class="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] animate-shimmer"></div>
        </div>
      </div>
    </div>

    <!-- Central Confidence Score Ring & Decision Badge -->
    <div class="relative flex flex-col items-center justify-center p-6 sm:p-xl bg-surface/80 backdrop-blur-xl border border-outline-variant/50 rounded-[2rem] shadow-xl mx-auto w-full max-w-lg mt-8 group transition-colors fade-in-up stagger-1">
      <!-- Luminous Glow Level 2 -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="w-[250px] h-[250px] ${decision === 'AUTO_APPROVE' ? 'bg-[#00C853]/10' : decision === 'REJECT' ? 'bg-error/10' : 'bg-amber-500/10'} blur-[60px] rounded-full transition-colors duration-1000"></div>
      </div>
      <!-- Segmented Ring System -->
      <div class="relative h-48 w-48 sm:h-56 sm:w-56 flex items-center justify-center mb-md">
        <!-- Background track -->
        <svg class="absolute inset-0 w-full h-full -rotate-90" viewbox="0 0 100 100">
          <circle class="text-outline-variant/50" cx="50" cy="50" fill="none" r="46" stroke="currentColor" stroke-dasharray="2 4" stroke-width="1.5"></circle>
        </svg>
        <!-- Glowing foreground track -->
        <svg class="absolute inset-0 w-full h-full -rotate-90 drop-shadow-[0_0_12px_rgba(0,200,83,0.4)]" viewbox="0 0 100 100">
          <circle class="${decision === 'AUTO_APPROVE' ? 'text-[#00C853]' : decision === 'REJECT' ? 'text-error' : 'text-amber-500'} transition-all duration-1500 ease-out" cx="50" cy="50" fill="none" r="46" stroke="currentColor" stroke-dasharray="0 289" stroke-linecap="round" stroke-width="3.5" id="confidence-ring"></circle>
        </svg>
        <div class="flex flex-col items-center justify-center z-10 text-center">
          <span class="font-display-lg text-display-lg text-on-surface tracking-tight font-black">${confidence}<span class="text-headline-md text-on-surface-variant font-medium">%</span></span>
          <span class="font-label-caps text-label-caps text-outline tracking-[0.2em] mt-2 font-bold uppercase">Confidence</span>
        </div>
      </div>
      <!-- Decision Badge -->
      <div class="flex flex-wrap items-center justify-center gap-sm px-8 py-3.5 rounded-full border z-10 opacity-0 transition-all duration-1000 transform translate-y-4 ${decisionTone}" id="decision-badge">
        <span class="material-symbols-outlined text-[22px]" style="font-variation-settings: 'FILL' 1;">${decisionIcon}</span>
        <span class="font-title-sm text-title-sm !text-[18px] tracking-[0.15em] font-black uppercase">${decisionLabel}</span>
      </div>
    </div>

    <!-- AI Explanation Card -->
    <div class="flex items-start gap-4 p-6 bg-surface-container-low/80 backdrop-blur-md border border-outline-variant/30 rounded-3xl relative overflow-hidden mx-auto w-full max-w-lg mt-6 shadow-md hover:shadow-lg transition-shadow fade-in-up stagger-2">
      <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-primary to-[#00C853]"></div>
      <div class="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
        <span class="material-symbols-outlined text-primary text-[24px]">memory</span>
      </div>
      <div class="flex flex-col gap-1.5">
        <h3 class="font-label-caps text-[11px] text-primary tracking-[0.2em] uppercase font-bold">Neural Analysis</h3>
        <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">${aiExplanation}</p>
      </div>
    </div>
    
    <!-- Submitted Context List Layout -->
    <div class="mx-auto mt-6 flex w-full max-w-lg flex-col gap-0 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest/80 backdrop-blur-md overflow-hidden shadow-md hover:shadow-lg transition-shadow fade-in-up stagger-3">
      <div class="flex items-center gap-3 border-b border-outline-variant/20 bg-surface-container-low/50 px-6 py-4 text-on-surface-variant">
        <span class="material-symbols-outlined text-[20px] text-primary">data_object</span>
        <span class="font-label-caps text-[12px] tracking-widest uppercase font-bold text-primary">Submitted Context</span>
      </div>
      <div class="flex flex-col p-2">
        <!-- Row 1 -->
        <div class="flex flex-col sm:flex-row gap-6 px-6 py-4 border-b border-outline-variant/10">
          <div class="flex-1">
            <p class="text-[10px] font-bold text-outline uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5"><span class="material-symbols-outlined text-[14px]">category</span> Claim Type</p>
            <p class="text-body-md text-on-surface font-semibold bg-surface-container-high/50 py-1.5 px-3 rounded-lg inline-block border border-outline-variant/20">${claimTypeLabel}</p>
          </div>
          <div class="flex-1">
            <p class="text-[10px] font-bold text-outline uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5"><span class="material-symbols-outlined text-[14px]">attach_file</span> Evidence</p>
            <div class="flex items-center gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-high/50 p-2.5">
              ${hasEvidenceImage ? `
                <img src="${escapeHtml(evidencePreviewUrl)}" alt="Evidence preview" class="h-12 w-12 shrink-0 rounded-lg border border-outline-variant/30 object-contain bg-surface-variant/20">
              ` : `
                <div id="evidence-slot" class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-outline-variant/40 bg-surface-container text-on-surface-variant">
                  <span class="material-symbols-outlined text-[18px]">attach_file</span>
                </div>
              `}
              <p class="min-w-0 text-body-md text-on-surface font-semibold truncate" title="${escapeHtml(evidenceSummary)}">${evidenceSummary}</p>
            </div>
          </div>
        </div>
        <!-- Row 2 -->
        <div class="px-6 py-4 border-b border-outline-variant/10">
          <p class="text-[10px] font-bold text-outline uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5"><span class="material-symbols-outlined text-[14px]">description</span> Problem Description</p>
          <p class="text-body-md text-on-surface-variant leading-relaxed bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30 shadow-inner">${submittedDescription}</p>
        </div>
        <!-- Row 3 -->
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-6 px-6 py-5 bg-surface-container-low/30 rounded-b-[1.25rem]">
          <div>
            <p class="text-[10px] font-bold text-outline uppercase tracking-[0.2em] mb-2">Backend Status</p>
            <p class="text-body-md text-on-surface font-bold flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full ${status === 'approved' ? 'bg-[#00C853] animate-pulse' : 'bg-amber-500 animate-pulse'}"></span> ${statusFormatted}</p>
          </div>
          <div>
            <p class="text-[10px] font-bold text-outline uppercase tracking-[0.2em] mb-2">AI Decision</p>
            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-widest uppercase ${decisionTone}">${decisionLabel}</span>
          </div>
          <div class="col-span-2 sm:col-span-1">
            <p class="text-[10px] font-bold text-outline uppercase tracking-[0.2em] mb-2">Updated At</p>
            <p class="text-[13px] text-on-surface font-semibold">${updatedAtLabel}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Bento Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mx-auto w-full max-w-lg mt-6 fade-in-up stagger-4">
      <!-- Damage Type -->
      <div class="flex flex-col p-6 bg-surface-container-lowest/80 backdrop-blur-md border border-outline-variant/30 rounded-3xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
        <div class="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-110 transition-all duration-500">
          <span class="material-symbols-outlined text-[100px]">broken_image</span>
        </div>
        <div class="flex items-center gap-2.5 mb-4 text-on-surface-variant">
          <div class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center">
            <span class="material-symbols-outlined text-[16px]">broken_image</span>
          </div>
          <span class="font-label-caps text-[10px] font-bold tracking-[0.2em] uppercase">Damage Type</span>
        </div>
        <span class="font-title-md text-title-md text-on-surface relative z-10 font-bold">${damageTypeLabel}</span>
      </div>
      
      <!-- Coverage -->
      <div class="flex flex-col p-6 bg-surface-container-lowest/80 backdrop-blur-md border border-outline-variant/30 rounded-3xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
        <div class="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-110 transition-all duration-500">
          <span class="material-symbols-outlined text-[100px]">shield</span>
        </div>
        <div class="flex items-center gap-2.5 mb-4 text-on-surface-variant">
          <div class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center">
            <span class="material-symbols-outlined text-[16px]">shield</span>
          </div>
          <span class="font-label-caps text-[10px] font-bold tracking-[0.2em] uppercase">Coverage</span>
        </div>
        <span class="font-title-md text-title-md relative z-10 font-bold ${coverageTone}">${coverageLabel}</span>
      </div>

      <!-- Refund Value -->
      <div class="flex flex-col p-6 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-3xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group sm:col-span-1">
        <div class="absolute -right-4 -top-4 w-32 h-32 bg-primary/20 blur-2xl rounded-full pointer-events-none group-hover:bg-primary/30 transition-colors duration-500"></div>
        <div class="absolute -left-4 -bottom-4 w-24 h-24 bg-[#00C853]/10 blur-xl rounded-full pointer-events-none group-hover:bg-[#00C853]/20 transition-colors duration-500"></div>
        <div class="flex items-center gap-2.5 mb-4 text-primary relative z-10">
          <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span class="material-symbols-outlined text-[16px]">payments</span>
          </div>
          <span class="font-label-caps text-[10px] font-bold tracking-[0.2em] uppercase">Refund Value</span>
        </div>
        <span class="font-display-sm text-display-sm !text-[26px] text-primary relative z-10 tracking-tight font-black break-words">Rp${refundValue.toLocaleString('id-ID')}</span>
      </div>
    </div>

    <!-- CTA Button -->
    <div class="mt-8 pt-lg pb-md flex w-full max-w-lg mx-auto fade-in-up stagger-5">
      <button id="finish-btn" class="w-full relative group flex justify-center items-center py-4 px-8 rounded-full overflow-hidden transition-all duration-300 shadow-lg hover:shadow-primary/30">
        <!-- Background gradient -->
        <div class="absolute inset-0 bg-gradient-to-r from-primary to-[#00C853] transition-transform duration-500 group-hover:scale-[1.03]"></div>
        <!-- Hover bloom -->
        <div class="absolute inset-0 opacity-0 group-hover:opacity-100 bg-white/20 transition-opacity duration-300"></div>
        <!-- Content -->
        <span class="relative z-10 font-label-caps text-label-caps text-white tracking-[0.15em] font-extrabold flex items-center gap-2 uppercase">
          ${ctaLabel}
          <span class="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
        </span>
      </button>
    </div>
  `;

  // Animation mock
  setTimeout(() => {
    const ring = container.querySelector('#confidence-ring');
    if(ring) ring.style.strokeDasharray = `${Math.round((289 * Math.max(0, Math.min(confidence, 100))) / 100)} 289`;
  }, 100);

  setTimeout(() => {
    const badge = container.querySelector('#decision-badge');
    if(badge) {
      badge.classList.remove('opacity-0', 'translate-y-4');
    }
  }, 1200);

  // Resolve evidence URL asynchronously and inject into the DOM
  // (img tags can't send Authorization headers, so we fetch + blob it)
  const rawUrl = claim?.evidence_url || state.draftClaim?.evidencePreviewUrl || '';
  if (rawUrl) {
    resolveEvidenceUrl(rawUrl).then(evidenceData => {
      if (!evidenceData) return;
      const slot = container.querySelector('#evidence-slot');
      if (slot) {
        if (evidenceData.type?.startsWith('video/')) {
          slot.outerHTML = `<video src="${evidenceData.url}" class="h-12 w-12 shrink-0 rounded-lg border border-outline-variant/30 object-contain bg-black/10" muted></video>`;
        } else {
          slot.outerHTML = `<img src="${evidenceData.url}" alt="Evidence preview" class="h-12 w-12 shrink-0 rounded-lg border border-outline-variant/30 object-contain bg-surface-variant/20">`;
        }
      }
      setCurrentClaim({ ...claim, evidence_url: rawUrl });
    }).catch(() => {});
  } else if (claim?.id) {
    // No URL in state at all — fetch full claim from API
    getClaim(claim.id).then(async freshClaim => {
      const url = freshClaim?.evidence_url;
      if (!url) return;
      const evidenceData = await resolveEvidenceUrl(url);
      if (!evidenceData) return;
      const slot = container.querySelector('#evidence-slot');
      if (slot) {
        if (evidenceData.type?.startsWith('video/')) {
          slot.outerHTML = `<video src="${evidenceData.url}" class="h-12 w-12 shrink-0 rounded-lg border border-outline-variant/30 object-contain bg-black/10" muted></video>`;
        } else {
          slot.outerHTML = `<img src="${evidenceData.url}" alt="Evidence preview" class="h-12 w-12 shrink-0 rounded-lg border border-outline-variant/30 object-contain bg-surface-variant/20">`;
        }
      }
      setCurrentClaim({ ...claim, evidence_url: url });
    }).catch(() => {});
  }

  const btn = container.querySelector('#finish-btn');
  if(btn) {
    btn.addEventListener('click', () => {
      setCurrentClaim(null);
      setCurrentClaimStatus(null);
      resetDraftClaim();
      navigate('hub');
    });
  }

  return container;
}
