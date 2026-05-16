export function renderCardSkeleton(rows = 3) {
  return Array.from({ length: rows }, () => `
    <div class="glass-card rounded-xl p-md">
      <div class="h-4 w-1/3 animate-pulse rounded-full bg-surface-container-highest"></div>
      <div class="mt-4 h-7 w-2/3 animate-pulse rounded-full bg-surface-container-high"></div>
      <div class="mt-3 h-4 w-1/2 animate-pulse rounded-full bg-surface-container-highest"></div>
    </div>
  `).join('');
}

export function renderNetworkState({
  icon = 'wifi_off',
  title = 'Belum tersambung',
  body = 'Kami belum bisa mengambil data terbaru. Periksa koneksi internet, lalu coba lagi.',
  retryLabel = 'Coba lagi',
  retryId = ''
} = {}) {
  return `
    <div class="glass-card rounded-xl border border-error/20 bg-error/5 p-md text-on-surface">
      <div class="flex items-start gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-error-container text-error">
          <span class="material-symbols-outlined text-[22px]">${icon}</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-title-sm">${title}</p>
          <p class="mt-1 text-body-sm text-on-surface-variant">${body}</p>
          ${retryId ? `
            <button id="${retryId}" type="button" class="mt-4 inline-flex items-center gap-2 rounded-full border border-outline-variant/60 bg-surface px-4 py-2 text-body-sm font-medium text-on-surface transition hover:border-primary/40 hover:text-primary">
              <span class="material-symbols-outlined text-[18px]">refresh</span>
              ${retryLabel}
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}
