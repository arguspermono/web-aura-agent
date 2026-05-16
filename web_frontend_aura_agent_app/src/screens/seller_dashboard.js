import { navigate } from '../main.js';
import { fetchSellerClaims } from '../services/api_service.js';

function getSellerClaimUiState(claim) {
  const sellerDecision = claim?.seller_decision?.decision || claim?.seller_decision;
  const aiVerdict = claim?.ai_verdict || claim?.ai_analysis?.verdict || claim?.ai_decision;
  const status = claim?.status;

  if (sellerDecision === 'approved' || status === 'approved' || status === 'refund_approved' || aiVerdict === 'APPROVE' || aiVerdict === 'AUTO_APPROVE') {
    return {
      tone: 'bg-secondary/10 text-secondary',
      text: 'Approved',
      icon: 'check_circle'
    };
  }

  if (sellerDecision === 'rejected' || status === 'rejected' || aiVerdict === 'REJECT' || aiVerdict === 'AUTO_REJECT') {
    return {
      tone: 'bg-error/10 text-error',
      text: 'Rejected',
      icon: 'cancel'
    };
  }

  if (status === 'under_review' || status === 'review' || status === 'complete' || aiVerdict === 'NEEDS_REVIEW') {
    return {
      tone: 'bg-amber-100 text-amber-700',
      text: 'Needs Review',
      icon: 'pending_actions'
    };
  }

  if (status === 'processing') {
    return {
      tone: 'bg-tertiary/10 text-tertiary',
      text: 'Analyzing AI',
      icon: 'progress_activity'
    };
  }

  return {
    tone: 'bg-primary/10 text-primary',
    text: 'Pending',
    icon: 'schedule'
  };
}

export function renderSellerDashboard() {
  const container = document.createElement('div');
  container.className = 'w-full min-h-[calc(100dvh-120px)] p-6 md:p-8 flex flex-col gap-6';

  container.innerHTML = `
    <div class="flex flex-col gap-2">
      <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10 text-secondary mb-2">
        <span class="material-symbols-outlined text-[28px]" style="font-variation-settings: 'FILL' 1;">storefront</span>
      </div>
      <h2 class="font-display-md text-display-md text-on-surface">Seller Dashboard</h2>
      <p class="text-body-md text-on-surface-variant">Review and manage customer claims.</p>
    </div>
    
    <div id="seller-claims-container" class="flex flex-col gap-4">
      <div class="flex items-center justify-center py-12 text-on-surface-variant text-body-md">
        <span class="material-symbols-outlined animate-spin mr-2">progress_activity</span> Loading claims...
      </div>
    </div>
  `;

  setTimeout(async () => {
    const claimsContainer = container.querySelector('#seller-claims-container');
    try {
      const claims = await fetchSellerClaims();
      
      if (claims.length === 0) {
        claimsContainer.innerHTML = `
          <div class="flex flex-col items-center justify-center py-16 text-center border border-dashed border-outline-variant/60 rounded-2xl bg-surface">
            <span class="material-symbols-outlined text-4xl text-outline mb-4">inbox</span>
            <p class="text-body-lg font-medium text-on-surface">No claims yet</p>
            <p class="text-body-sm text-on-surface-variant mt-1 max-w-sm">You don't have any incoming customer claims to review.</p>
          </div>
        `;
        return;
      }
      
      claimsContainer.innerHTML = '';
      
      claims.forEach((claim) => {
        const card = document.createElement('div');
        const sellerState = getSellerClaimUiState(claim);
        card.className = 'flex flex-col gap-3 rounded-2xl border border-outline-variant/50 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/50 cursor-pointer group';
        
        card.addEventListener('click', () => {
          navigate('seller_claim_detail', claim.claim_id);
        });

        card.innerHTML = `
          <div class="flex justify-between items-start">
            <div class="flex flex-col">
              <span class="text-label-sm uppercase tracking-wider text-on-surface-variant mb-1 group-hover:text-primary transition-colors">Claim ID: ${claim.claim_id.substring(0, 8)}...</span>
              <h3 class="font-title-md text-on-surface">${claim.damage_type || 'Product Claim'}</h3>
            </div>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-sm font-medium ${sellerState.tone}">
              <span class="material-symbols-outlined text-[16px]" style="font-variation-settings: 'FILL' 1;">${sellerState.icon}</span>
              ${sellerState.text}
            </span>
          </div>
          
          <div class="flex items-center gap-4 mt-2">
            <div class="flex flex-col">
              <span class="text-label-sm text-on-surface-variant">Date</span>
              <span class="text-body-sm text-on-surface">${new Date(claim.created_at).toLocaleDateString()}</span>
            </div>
            ${claim.ai_verdict ? `
              <div class="flex flex-col">
                <span class="text-label-sm text-on-surface-variant">AI Verdict</span>
                <span class="text-body-sm font-medium ${claim.ai_verdict === 'APPROVE' || claim.ai_verdict === 'AUTO_APPROVE' ? 'text-secondary' : claim.ai_verdict === 'NEEDS_REVIEW' ? 'text-amber-700' : 'text-error'}">${claim.ai_verdict}</span>
              </div>
              <div class="flex flex-col">
                <span class="text-label-sm text-on-surface-variant">Confidence</span>
                <span class="text-body-sm text-on-surface">${Math.round((claim.confidence_score || 0) * 100)}%</span>
              </div>
            ` : ''}
          </div>
        `;
        
        claimsContainer.appendChild(card);
      });
      
    } catch (error) {
      claimsContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-center text-error border border-error/20 rounded-2xl bg-error/5">
          <span class="material-symbols-outlined text-4xl mb-2">error</span>
          <p class="text-body-md">Failed to load claims</p>
          <p class="text-body-sm opacity-80 mt-1">${error.message}</p>
        </div>
      `;
    }
  }, 0);

  return container;
}
