import { getSellerClaimDetail, submitSellerDecision, resolveEvidenceUrl } from '../services/api_service.js';
import { navigate } from '../main.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}


function getSellerClaimUiState(detail) {
  const sellerDecision = detail?.seller_decision?.decision || detail?.seller_decision;
  const aiVerdict = detail?.ai_analysis?.verdict || detail?.ai_verdict || detail?.ai_decision;
  const status = detail?.status;

  if (sellerDecision === 'approved' || status === 'approved' || status === 'refund_approved' || aiVerdict === 'APPROVE' || aiVerdict === 'AUTO_APPROVE') {
    return {
      tone: 'bg-secondary/10 text-secondary',
      text: 'Approved',
      icon: 'check_circle',
      reviewable: false
    };
  }

  if (sellerDecision === 'rejected' || status === 'rejected' || aiVerdict === 'REJECT' || aiVerdict === 'AUTO_REJECT') {
    return {
      tone: 'bg-error/10 text-error',
      text: 'Rejected',
      icon: 'cancel',
      reviewable: false
    };
  }

  if (status === 'under_review' || status === 'review' || status === 'complete' || aiVerdict === 'NEEDS_REVIEW') {
    return {
      tone: 'bg-amber-100 text-amber-700',
      text: 'Needs Review',
      icon: 'pending_actions',
      reviewable: true
    };
  }

  if (status === 'processing') {
    return {
      tone: 'bg-tertiary/10 text-tertiary',
      text: 'Analyzing AI',
      icon: 'progress_activity',
      reviewable: false
    };
  }

  return {
    tone: 'bg-primary/10 text-primary',
    text: 'Pending',
    icon: 'schedule',
    reviewable: false
  };
}

export function renderSellerClaimDetail(claimId) {
  const container = document.createElement('div');
  container.className = 'w-full min-h-[calc(100dvh-120px)] flex flex-col gap-6 p-4 md:p-8 max-w-4xl mx-auto';

  container.innerHTML = `
    <div class="flex items-center gap-4">
      <button id="back-btn" class="flex h-10 w-10 items-center justify-center rounded-full bg-surface-variant/50 text-on-surface hover:bg-surface-variant transition-colors">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <h2 class="font-display-md text-display-md text-on-surface">Claim Detail</h2>
    </div>

    <div id="detail-content" class="flex flex-col gap-6">
      <div class="flex items-center justify-center py-20 text-on-surface-variant">
        <span class="material-symbols-outlined animate-spin mr-2">progress_activity</span> Loading detail...
      </div>
    </div>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => {
    navigate('seller_dashboard');
  });

  setTimeout(async () => {
    const content = container.querySelector('#detail-content');
    try {
      const detail = await getSellerClaimDetail(claimId);
      const { created_at, customer_reason, ai_analysis, seller_decision } = detail;
      // Resolve through authenticated backend proxy -> blob URL for <img src>
      const rawEvidenceUrl = detail?.evidence_url || detail?.file_urls?.[0] || '';
      const evidenceData = await resolveEvidenceUrl(rawEvidenceUrl);
      const sellerState = getSellerClaimUiState(detail);
      const hasDecision = !!seller_decision;
      const isReviewable = !hasDecision && sellerState.reviewable;

      content.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="flex flex-col gap-4">
            <div class="rounded-2xl border border-outline-variant/50 bg-white p-5 shadow-sm">
              <div class="flex justify-between items-center mb-4">
                <h3 class="font-title-md text-on-surface">Customer Report</h3>
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-sm font-medium ${sellerState.tone}">
                  <span class="material-symbols-outlined text-[16px]" style="font-variation-settings: 'FILL' 1;">${sellerState.icon}</span>
                  ${sellerState.text}
                </span>
              </div>
              
              <div class="mb-4">
                <p class="text-label-sm text-on-surface-variant mb-1">Date Submitted</p>
                <p class="text-body-md text-on-surface">${new Date(created_at).toLocaleString()}</p>
              </div>

              <div class="mb-4">
                <p class="text-label-sm text-on-surface-variant mb-1">Customer Reason</p>
                <div class="bg-surface-variant/30 p-3 rounded-xl border border-outline-variant/30 text-body-md text-on-surface italic">
                  "${customer_reason || 'No description provided.'}"
                </div>
              </div>

              <div>
                <p class="text-label-sm text-on-surface-variant mb-2">Evidence Attachment</p>
                ${evidenceData ? `
                  <div class="overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-variant/20">
                    ${evidenceData.type?.startsWith('video/')
                      ? `<video src="${escapeHtml(evidenceData.url)}" controls class="w-full h-auto max-h-64 object-contain bg-black/10"></video>`
                      : `<img src="${escapeHtml(evidenceData.url)}" alt="Evidence" class="w-full h-auto max-h-64 object-contain bg-surface-variant/20">`}
                  </div>
                ` : `
                  <div class="flex items-center justify-center h-32 bg-surface-variant/30 rounded-xl border border-dashed border-outline-variant/60 text-on-surface-variant">
                    <span class="material-symbols-outlined mr-2">image</span> Evidence securely stored.
                  </div>
                `}
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-4">
            <div class="rounded-2xl border border-outline-variant/50 bg-white p-5 shadow-sm">
              <div class="flex items-center gap-2 mb-4 text-tertiary">
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">auto_awesome</span>
                <h3 class="font-title-md">Aura AI Analysis</h3>
              </div>
              
              ${ai_analysis && ai_analysis.verdict ? `
                <div class="flex items-center justify-between mb-4 pb-4 border-b border-outline-variant/30">
                  <div class="flex flex-col">
                    <span class="text-label-sm text-on-surface-variant">Recommendation</span>
                    <span class="font-title-lg ${ai_analysis.verdict === 'APPROVE' || ai_analysis.verdict === 'AUTO_APPROVE' ? 'text-secondary' : ai_analysis.verdict === 'NEEDS_REVIEW' ? 'text-amber-700' : 'text-error'}">${ai_analysis.verdict}</span>
                  </div>
                  <div class="flex flex-col items-end">
                    <span class="text-label-sm text-on-surface-variant">Confidence</span>
                    <span class="font-title-lg text-on-surface">${Math.round((ai_analysis.confidence_score || 0) * 100)}%</span>
                  </div>
                </div>
                
                <div class="mb-3">
                  <p class="text-label-sm text-on-surface-variant mb-1">Detected Damage</p>
                  <p class="text-body-sm text-on-surface bg-error/5 p-2 rounded-lg border border-error/10">${ai_analysis.damage_description || 'None clearly specified.'}</p>
                </div>
                
                <div>
                  <p class="text-label-sm text-on-surface-variant mb-1">AI Reasoning</p>
                  <p class="text-body-sm text-on-surface-variant leading-relaxed">${ai_analysis.recommendation || 'No detailed reasoning provided.'}</p>
                </div>
              ` : `
                <div class="py-4 text-center text-on-surface-variant text-body-sm">
                  <p>AI Analysis is pending or not available for this claim.</p>
                </div>
              `}
            </div>

            <div class="rounded-2xl border border-outline-variant/50 bg-white p-5 shadow-sm">
              <h3 class="font-title-md text-on-surface mb-4">Your Decision</h3>
              
              ${hasDecision ? `
                <div class="flex items-center p-4 rounded-xl border ${seller_decision.decision === 'approved' ? 'bg-secondary/10 border-secondary/30 text-secondary' : 'bg-error/10 border-error/30 text-error'}">
                  <span class="material-symbols-outlined mr-3" style="font-variation-settings: 'FILL' 1;">${seller_decision.decision === 'approved' ? 'check_circle' : 'cancel'}</span>
                  <div>
                    <p class="font-title-sm capitalize">You ${seller_decision.decision === 'approved' ? 'Approved' : 'Rejected'} this claim.</p>
                    ${seller_decision.seller_note ? `<p class="text-body-sm mt-1 opacity-80">Note: ${seller_decision.seller_note}</p>` : ''}
                  </div>
                </div>
              ` : `
                ${isReviewable ? `
                  <div class="flex flex-col gap-4">
                    <textarea id="seller-note" class="w-full rounded-xl border border-outline-variant/60 bg-surface p-3 text-body-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none h-24" placeholder="Optional: Add a note to the buyer explaining your decision..."></textarea>
                    
                    <div class="flex gap-3 mt-2">
                      <button id="btn-reject" data-decision="rejected" class="flex-1 flex items-center justify-center gap-2 rounded-xl border border-error text-error px-4 py-3 font-title-sm hover:bg-error/10 transition">
                        <span class="material-symbols-outlined text-[18px]">close</span> Reject
                      </button>
                      <button id="btn-approve" data-decision="approved" class="flex-1 flex items-center justify-center gap-2 rounded-xl bg-secondary text-white px-4 py-3 font-title-sm shadow-lg shadow-secondary/25 hover:bg-secondary/90 transition">
                        <span class="material-symbols-outlined text-[18px]">check</span> Approve
                      </button>
                    </div>
                  </div>
                ` : `
                  <div class="p-4 bg-surface-variant/30 rounded-xl text-center text-body-sm text-on-surface-variant">
                    ${sellerState.text === 'Approved'
                      ? 'This claim was auto-approved by AI, so no seller review is needed.'
                      : sellerState.text === 'Rejected'
                        ? 'This claim was auto-rejected by AI, so no seller review is needed.'
                        : 'This claim is not currently open for review.'}
                  </div>
                `}
              `}
            </div>
          </div>
        </div>
      `;

      if (!hasDecision && isReviewable) {
        const btnApprove = content.querySelector('#btn-approve');
        const btnReject = content.querySelector('#btn-reject');
        const noteInput = content.querySelector('#seller-note');

        const handleDecision = async (decision) => {
          btnApprove.disabled = true;
          btnReject.disabled = true;
          const originalText = decision === 'approved' ? btnApprove.innerHTML : btnReject.innerHTML;
          const btn = decision === 'approved' ? btnApprove : btnReject;
          
          btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Processing...`;
          
          try {
            await submitSellerDecision(claimId, decision, noteInput.value.trim());
            renderSellerClaimDetail(claimId);
            setTimeout(() => navigate('seller_dashboard'), 1500);
          } catch (e) {
            btn.innerHTML = originalText;
            btnApprove.disabled = false;
            btnReject.disabled = false;
            alert(e.message || 'Failed to submit decision');
          }
        };

        btnApprove.addEventListener('click', () => handleDecision('approved'));
        btnReject.addEventListener('click', () => handleDecision('rejected'));
      }
      
    } catch (error) {
      content.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-center text-error border border-error/20 rounded-2xl bg-error/5">
          <span class="material-symbols-outlined text-4xl mb-2">error</span>
          <p class="text-body-md">Failed to load claim detail</p>
          <p class="text-body-sm opacity-80 mt-1">${error.message}</p>
        </div>
      `;
    }
  }, 0);

  return container;
}
