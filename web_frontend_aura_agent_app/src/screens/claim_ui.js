const currency = new Intl.NumberFormat('id-ID');

export function toTitleCase(value, fallback = 'Unknown Claim') {
  if (!value) return fallback;

  return String(value)
    .replaceAll('-', ' ')
    .replaceAll('_', ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function getClaimAmount(claim) {
  return Number(claim.refund_value || claim.refund_amount || 0);
}

export function formatCurrency(amount) {
  return `Rp${currency.format(Number(amount || 0))}`;
}

export function normalizeClaimStatus(status) {
  if (['approved', 'refund_approved'].includes(status)) {
    return 'approved';
  }

  if (['review', 'under_review', 'complete'].includes(status)) {
    return 'review';
  }

  if (status === 'rejected') {
    return 'rejected';
  }

  return 'processing';
}

export function getStatusMeta(status) {
  const normalizedStatus = normalizeClaimStatus(status);

  if (normalizedStatus === 'approved') {
    return {
      border: 'border-l-secondary',
      iconBg: 'bg-secondary-container/20',
      iconText: 'text-secondary',
      icon: 'check_circle',
      dot: 'bg-secondary',
      label: 'Approved'
    };
  }

  if (normalizedStatus === 'rejected') {
    return {
      border: 'border-l-error',
      iconBg: 'bg-error-container/20',
      iconText: 'text-error',
      icon: 'block',
      dot: 'bg-error',
      label: 'Rejected'
    };
  }

  if (normalizedStatus === 'review') {
    return {
      border: 'border-l-amber-500',
      iconBg: 'bg-amber-100',
      iconText: 'text-amber-600',
      icon: 'shield',
      dot: 'bg-amber-500',
      label: 'Manual Review'
    };
  }

  return {
    border: 'border-l-primary',
    iconBg: 'bg-surface-container-highest',
    iconText: 'text-primary',
    icon: 'hourglass_top',
    dot: 'bg-primary',
    label: 'Processing'
  };
}

export function getClaimStepLabel(claim) {
  if (claim?.current_step) {
    return toTitleCase(claim.current_step, 'Processing');
  }

  return getStatusMeta(claim?.status).label;
}

export function sortClaimsByUpdatedAt(claims) {
  return [...claims].sort((a, b) => {
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
}

export function renderClaimCard(claim, options = {}) {
  const { showDate = false } = options;
  const amount = getClaimAmount(claim);
  const meta = getStatusMeta(claim.status);
  const normalizedStatus = normalizeClaimStatus(claim.status);
  const claimTypeLabel = toTitleCase(claim.claim_type);
  const stepLabel = getClaimStepLabel(claim);
  const dateLabel = claim.created_at
    ? new Date(claim.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Claim Record';
    
  const showExplanation = Boolean(claim.ai_explanation?.trim());
  const explanationSnippet = showExplanation 
    ? (claim.ai_explanation.length > 80 ? claim.ai_explanation.substring(0, 80) + '...' : claim.ai_explanation)
    : null;
  const noteAccent = normalizedStatus === 'approved'
    ? 'bg-secondary text-secondary'
    : normalizedStatus === 'rejected'
      ? 'bg-error text-error'
      : normalizedStatus === 'review'
        ? 'bg-amber-500 text-amber-700'
        : 'bg-primary text-primary';

  return `
    <div class="glass-card rounded-xl border-l-4 ${meta.border} p-md flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-start gap-md min-w-0">
        <div class="w-12 h-12 rounded-lg ${meta.iconBg} flex items-center justify-center ${meta.iconText} shrink-0">
          <span class="material-symbols-outlined">${meta.icon}</span>
        </div>
        <div class="min-w-0">
          <h5 class="font-title-sm text-on-surface break-words">${claimTypeLabel}</h5>
          <p class="text-body-sm text-on-surface-variant flex items-center gap-base">
            <span class="w-2 h-2 rounded-full ${meta.dot}"></span>
            ${stepLabel}
          </p>
          ${showDate ? `<p class="mt-2 text-label-sm text-on-surface-variant">Submitted ${dateLabel}</p>` : ''}
          ${showExplanation ? `
            <div class="mt-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 relative">
              <div class="absolute -left-1.5 top-3 w-1 h-8 rounded-r-full opacity-60 ${noteAccent.split(' ')[0]}"></div>
              <p class="text-label-sm font-semibold mb-1 flex items-center gap-1 ${noteAccent.split(' ')[1]}"><span class="material-symbols-outlined text-[12px]">auto_awesome</span> AI Note</p>
              <p class="text-body-sm text-on-surface-variant italic leading-snug">"${explanationSnippet}"</p>
            </div>
          ` : ''}
        </div>
      </div>
      <div class="text-left sm:text-right shrink-0">
        <p class="font-title-sm text-on-surface">${formatCurrency(amount)}</p>
        <p class="mt-1 text-body-sm font-semibold ${meta.iconText}">${meta.label}</p>
      </div>
    </div>
  `;
}
