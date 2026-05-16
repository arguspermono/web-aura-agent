import { navigate, setCurrentClaim, setCurrentClaimStatus, state, updateDraftClaim } from '../main.js';
import { analyzeClaim, createClaim, uploadEvidence } from '../services/api_service.js';

const submitLabels = {
  idle: 'Analyze with AURA AI',
  uploading: 'Uploading evidence...',
  creating: 'Creating claim record...',
  starting: 'Starting backend analysis...'
};

const MAX_EVIDENCE_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const rupiahFormatter = new Intl.NumberFormat('id-ID');

function getFilePreviewName(file) {
  return `${file.name} - ${Math.max(1, Math.round(file.size / 1024))} KB`;
}

function getFilePreviewUrl(file) {
  if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
    return URL.createObjectURL(file);
  }
  return '';
}

function formatFileSize(bytes) {
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes % 1 === 0 ? megabytes.toFixed(0) : megabytes.toFixed(1)} MB`;
}

function parseRupiah(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

function formatRupiah(value) {
  const amount = Number(value || 0);
  return amount > 0 ? `Rp${rupiahFormatter.format(amount)}` : '';
}

export function renderEvidence() {
  const container = document.createElement('div');
  container.className = 'w-full max-w-md mx-auto flex flex-col gap-8 pb-4';
  const draft = state.draftClaim;

  container.innerHTML = `
    <div class="flex flex-col gap-2">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h1 class="font-headline-md text-headline-md text-on-surface">Step 1 of 3</h1>
        <span class="font-label-caps text-label-caps text-secondary uppercase">Evidence Collection</span>
      </div>
      <div class="w-full h-1 bg-surface-variant rounded-full overflow-hidden relative">
        <div class="h-full bg-secondary w-1/3 absolute left-0 top-0 rounded-full shadow-[0_0_10px_rgba(0,110,42,0.3)]"></div>
      </div>
    </div>

    <div class="flex flex-col gap-4">
      <h2 class="font-title-sm text-title-sm text-on-surface-variant">Select Claim Type</h2>
      <div class="grid grid-cols-1 gap-3" id="claim-type-grid">
        <button class="claim-btn w-full border rounded-xl p-4 flex items-center justify-between gap-3 relative overflow-hidden group transition-all ${draft.claimType === 'product_defect' ? 'bg-secondary/5 border-secondary shadow-sm' : 'bg-surface-container-lowest border-outline-variant hover:border-outline hover:shadow-sm'}" data-claim-type="product_defect">
          <div class="flex min-w-0 items-center gap-3 relative z-10">
            <div class="icon-bg w-10 h-10 rounded-full flex items-center justify-center border ${draft.claimType === 'product_defect' ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-surface-container text-on-surface-variant border-outline-variant/30'}">
              <span class="material-symbols-outlined" data-icon="inventory_2" data-weight="fill" style="font-variation-settings: 'FILL' ${draft.claimType === 'product_defect' ? 1 : 0};">inventory_2</span>
            </div>
            <span class="label-text font-body-md text-body-md ${draft.claimType === 'product_defect' ? 'text-on-surface font-medium' : 'text-on-surface-variant'}">Product Defect</span>
          </div>
          <div class="radio-outer w-5 h-5 rounded-full border-2 flex items-center justify-center relative z-10 ${draft.claimType === 'product_defect' ? 'border-secondary bg-secondary/10' : 'border-outline-variant'}">
            <div class="radio-inner w-2.5 h-2.5 rounded-full bg-secondary ${draft.claimType === 'product_defect' ? '' : 'hidden'}"></div>
          </div>
        </button>
        <button class="claim-btn w-full border rounded-xl p-4 flex items-center justify-between gap-3 relative overflow-hidden group transition-all ${draft.claimType === 'shipping_damage' ? 'bg-secondary/5 border-secondary shadow-sm' : 'bg-surface-container-lowest border-outline-variant hover:border-outline hover:shadow-sm'}" data-claim-type="shipping_damage">
          <div class="flex min-w-0 items-center gap-3 relative z-10">
            <div class="icon-bg w-10 h-10 rounded-full flex items-center justify-center border ${draft.claimType === 'shipping_damage' ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-surface-container text-on-surface-variant border-outline-variant/30'}">
              <span class="material-symbols-outlined" data-icon="local_shipping" style="font-variation-settings: 'FILL' ${draft.claimType === 'shipping_damage' ? 1 : 0};">local_shipping</span>
            </div>
            <span class="label-text font-body-md text-body-md ${draft.claimType === 'shipping_damage' ? 'text-on-surface font-medium' : 'text-on-surface-variant'}">Shipping Damage</span>
          </div>
          <div class="radio-outer w-5 h-5 rounded-full border-2 flex items-center justify-center relative z-10 ${draft.claimType === 'shipping_damage' ? 'border-secondary bg-secondary/10' : 'border-outline-variant'}">
            <div class="radio-inner w-2.5 h-2.5 rounded-full bg-secondary ${draft.claimType === 'shipping_damage' ? '' : 'hidden'}"></div>
          </div>
        </button>
        <button class="claim-btn w-full border rounded-xl p-4 flex items-center justify-between gap-3 relative overflow-hidden group transition-all ${draft.claimType === 'missing_item' ? 'bg-secondary/5 border-secondary shadow-sm' : 'bg-surface-container-lowest border-outline-variant hover:border-outline hover:shadow-sm'}" data-claim-type="missing_item">
          <div class="flex min-w-0 items-center gap-3 relative z-10">
            <div class="icon-bg w-10 h-10 rounded-full flex items-center justify-center border ${draft.claimType === 'missing_item' ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-surface-container text-on-surface-variant border-outline-variant/30'}">
              <span class="material-symbols-outlined" data-icon="search_off" style="font-variation-settings: 'FILL' ${draft.claimType === 'missing_item' ? 1 : 0};">search_off</span>
            </div>
            <span class="label-text font-body-md text-body-md ${draft.claimType === 'missing_item' ? 'text-on-surface font-medium' : 'text-on-surface-variant'}">Missing Item</span>
          </div>
          <div class="radio-outer w-5 h-5 rounded-full border-2 flex items-center justify-center relative z-10 ${draft.claimType === 'missing_item' ? 'border-secondary bg-secondary/10' : 'border-outline-variant'}">
            <div class="radio-inner w-2.5 h-2.5 rounded-full bg-secondary ${draft.claimType === 'missing_item' ? '' : 'hidden'}"></div>
          </div>
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-title-sm text-title-sm text-on-surface-variant">Upload Evidence</h2>
        <span class="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Required</span>
      </div>
      <input id="evidence-file-input" type="file" class="hidden" accept="image/*,video/*,audio/*" />
      <div id="evidence-dropzone" class="w-full rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-6 sm:p-8 flex flex-col items-center justify-center text-center relative overflow-hidden group shadow-sm cursor-pointer hover:bg-primary/10 transition-colors">
        <div class="w-16 h-16 rounded-full bg-surface/80 backdrop-blur-md border border-primary/20 flex items-center justify-center mb-4 relative z-10 shadow-md">
          <span class="material-symbols-outlined text-primary text-3xl" data-icon="cloud_upload">cloud_upload</span>
          <div class="absolute inset-0 rounded-full border border-primary/30 animate-pulse"></div>
        </div>
        <h3 class="font-headline-md text-headline-md text-on-surface mb-2 relative z-10">Drop Photo or Video</h3>
        <p class="font-body-sm text-body-sm text-on-surface-variant relative z-10 max-w-[220px] mb-4">Select one evidence file for the live demo. Max 20MB.</p>
        <button id="browse-files-btn" type="button" class="bg-surface border border-outline-variant rounded-full px-6 py-2 font-label-caps text-label-caps text-primary uppercase tracking-wider relative z-10 hover:bg-surface-variant transition-colors shadow-sm">
          ${draft.evidencePreviewName && !draft.evidenceNeedsReselection ? 'Replace File' : 'Browse Files'}
        </button>
      </div>
      <div id="selected-file-card" class="rounded-2xl border border-outline-variant/50 bg-surface-container-low p-4 ${draft.evidencePreviewName ? '' : 'hidden'}">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="font-label-caps text-label-caps text-primary uppercase tracking-wider">Selected Evidence</p>
            <div id="selected-file-preview-container" class="mt-3 mb-3 rounded-xl overflow-hidden bg-surface-variant/30 max-h-48 flex items-center justify-center ${draft.evidencePreviewUrl ? '' : 'hidden'}">
              <img id="selected-file-preview-img" src="${draft.evidenceMimeType?.startsWith('image/') ? draft.evidencePreviewUrl : ''}" class="max-h-48 w-full object-contain ${draft.evidenceMimeType?.startsWith('image/') ? '' : 'hidden'}" />
              <video id="selected-file-preview-video" src="${draft.evidenceMimeType?.startsWith('video/') ? draft.evidencePreviewUrl : ''}" class="max-h-48 w-full object-contain ${draft.evidenceMimeType?.startsWith('video/') ? '' : 'hidden'}" controls></video>
            </div>
            <p id="selected-file-name" class="break-words text-body-md text-on-surface">${draft.evidencePreviewName || ''}</p>
            <p id="selected-file-hint" class="mt-1 text-body-sm text-on-surface-variant ${draft.evidenceNeedsReselection ? '' : 'hidden'}">This file was restored from a previous draft. Re-attach it before submitting.</p>
          </div>
          <button id="remove-file-btn" type="button" class="shrink-0 rounded-full border border-outline-variant px-3 py-2 text-body-sm text-on-surface-variant hover:bg-surface">
            Remove
          </button>
        </div>
      </div>
      <p id="file-error" class="hidden text-body-sm text-error"></p>
    </div>

    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-title-sm text-title-sm text-on-surface-variant">Item Value</h2>
          <p class="mt-1 text-body-sm text-on-surface-variant">Enter the item price in Rupiah for refund calculation.</p>
        </div>
        <span class="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Required</span>
      </div>
      <label class="rounded-2xl border border-outline-variant/50 bg-white/70 p-4 shadow-sm backdrop-blur-md">
        <span class="mb-3 flex items-center gap-2 text-body-sm font-medium text-on-surface">
          <span class="material-symbols-outlined text-primary text-[18px]">payments</span>
          Item price
        </span>
        <input id="item-value-input" type="text" inputmode="numeric" class="min-h-12 w-full rounded-xl border border-outline-variant/60 bg-surface px-4 py-3 text-headline-md font-semibold text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Rp250.000" value="${formatRupiah(draft.itemValue)}" />
      </label>
      <p id="item-value-error" class="hidden text-body-sm text-error"></p>
    </div>

    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-title-sm text-title-sm text-on-surface-variant">Problem Description</h2>
          <p class="mt-1 text-body-sm text-on-surface-variant">Write short context so reviewer and AI understand issue faster.</p>
        </div>
        <span class="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Required</span>
      </div>
      <div class="rounded-2xl border border-outline-variant/50 bg-white/70 p-4 shadow-sm backdrop-blur-md">
        <label class="mb-3 flex items-center gap-2 text-body-sm font-medium text-on-surface" for="claim-description">
          <span class="material-symbols-outlined text-primary text-[18px]">edit_note</span>
          Explain what happened
        </label>
        <textarea id="claim-description" class="min-h-[132px] w-full resize-none rounded-xl border border-outline-variant/60 bg-surface px-4 py-3 text-body-md text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Example: Screen cracked after package arrived. Box had visible dent on the lower-right corner and device would not turn on after unboxing.">${draft.textDescription}</textarea>
        <div class="mt-3 flex items-start gap-2 text-body-sm text-on-surface-variant">
          <span class="material-symbols-outlined mt-0.5 text-[16px] text-primary/70">lightbulb</span>
          Include timeline, visible damage, and anything unusual during delivery or usage.
        </div>
      </div>
    </div>

    <div class="sticky bottom-4 z-20 mt-2 pb-1">
      <div class="rounded-[1.5rem] border border-white/50 bg-white/70 p-3 shadow-[0_18px_48px_rgba(70,72,212,0.18)] backdrop-blur-xl">
        <button id="evidence-analyze-btn" class="pointer-events-auto w-full bg-primary text-on-primary rounded-xl py-4 px-6 flex items-center justify-center gap-2 shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all group">
          <span class="material-symbols-outlined text-on-primary" data-icon="psychiatry">psychiatry</span>
          <span id="analyze-btn-label" class="font-title-sm text-title-sm text-on-primary font-semibold">${submitLabels.idle}</span>
        </button>
        <p id="submit-state" class="hidden px-2 pt-3 text-body-sm text-on-surface-variant"></p>
        <p id="submit-error" class="hidden px-2 pt-3 text-body-sm text-error"></p>
      </div>
    </div>
  `;

  const btns = container.querySelectorAll('.claim-btn');
  const descriptionField = container.querySelector('#claim-description');
  const itemValueInput = container.querySelector('#item-value-input');
  const fileInput = container.querySelector('#evidence-file-input');
  const browseButton = container.querySelector('#browse-files-btn');
  const dropzone = container.querySelector('#evidence-dropzone');
  const selectedFileCard = container.querySelector('#selected-file-card');
  const selectedFileName = container.querySelector('#selected-file-name');
  const selectedFileHint = container.querySelector('#selected-file-hint');
  const removeFileButton = container.querySelector('#remove-file-btn');
  const fileError = container.querySelector('#file-error');
  const itemValueError = container.querySelector('#item-value-error');
  const submitError = container.querySelector('#submit-error');
  const submitState = container.querySelector('#submit-state');
  const analyzeBtn = container.querySelector('#evidence-analyze-btn');
  const analyzeBtnLabel = container.querySelector('#analyze-btn-label');
  const refreshFileUi = () => {
    const { evidencePreviewName, evidenceNeedsReselection, evidencePreviewUrl, evidenceMimeType } = state.draftClaim;
    selectedFileCard.classList.toggle('hidden', !evidencePreviewName);
    selectedFileName.textContent = evidencePreviewName || '';
    selectedFileHint.classList.toggle('hidden', !evidenceNeedsReselection);
    browseButton.textContent = evidencePreviewName && !evidenceNeedsReselection ? 'Replace File' : 'Browse Files';

    const previewContainer = container.querySelector('#selected-file-preview-container');
    const previewImg = container.querySelector('#selected-file-preview-img');
    const previewVideo = container.querySelector('#selected-file-preview-video');

    if (previewContainer) {
      previewContainer.classList.toggle('hidden', !evidencePreviewUrl);
      if (evidencePreviewUrl) {
        const isImage = evidenceMimeType?.startsWith('image/');
        const isVideo = evidenceMimeType?.startsWith('video/');
        
        previewImg.classList.toggle('hidden', !isImage);
        previewVideo.classList.toggle('hidden', !isVideo);
        
        if (isImage) {
          previewImg.src = evidencePreviewUrl;
          previewVideo.src = '';
        } else if (isVideo) {
          previewVideo.src = evidencePreviewUrl;
          previewImg.src = '';
        }
      } else {
        previewImg.src = '';
        previewVideo.src = '';
      }
    }
  };

  const revokeDraftPreviewUrl = () => {
    const previewUrl = state.draftClaim?.evidencePreviewUrl;
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
  };

  const clearFileError = () => {
    fileError.classList.add('hidden');
    fileError.textContent = '';
  };

  const clearItemValueError = () => {
    itemValueError.classList.add('hidden');
    itemValueError.textContent = '';
  };

  const setSubmitState = (mode, helperText = '') => {
    const isBusy = mode !== 'idle';
    analyzeBtn.disabled = isBusy;
    analyzeBtn.classList.toggle('opacity-70', isBusy);
    analyzeBtn.classList.toggle('cursor-not-allowed', isBusy);
    analyzeBtnLabel.textContent = submitLabels[mode] || submitLabels.idle;
    submitState.textContent = helperText;
    submitState.classList.toggle('hidden', !helperText);
  };

  const setFile = (file) => {
    if (!file) return;
    if (file.size > MAX_EVIDENCE_FILE_SIZE_BYTES) {
      clearFile();
      fileError.textContent = `File terlalu besar. Gunakan file maksimal ${formatFileSize(MAX_EVIDENCE_FILE_SIZE_BYTES)}.`;
      fileError.classList.remove('hidden');
      return;
    }
    revokeDraftPreviewUrl();
    updateDraftClaim({
      evidenceFile: file,
      evidencePreviewName: getFilePreviewName(file),
      evidencePreviewUrl: getFilePreviewUrl(file),
      evidenceMimeType: file.type || '',
      evidenceNeedsReselection: false
    });
    fileInput.value = '';
    refreshFileUi();
    clearFileError();
  };

  const clearFile = () => {
    revokeDraftPreviewUrl();
    updateDraftClaim({
      evidenceFile: null,
      evidencePreviewName: '',
      evidencePreviewUrl: '',
      evidenceMimeType: '',
      evidenceNeedsReselection: false
    });
    fileInput.value = '';
    refreshFileUi();
  };

  refreshFileUi();
  setSubmitState('idle');

  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      updateDraftClaim({ claimType: btn.dataset.claimType });
      navigate('evidence');
    });
  });

  descriptionField.addEventListener('input', (event) => {
    updateDraftClaim({ textDescription: event.target.value });
  });

  itemValueInput.addEventListener('input', (event) => {
    const itemValue = parseRupiah(event.target.value);
    event.target.value = formatRupiah(itemValue);
    updateDraftClaim({ itemValue, refundAmount: itemValue });
    clearItemValueError();
  });

  browseButton.addEventListener('click', (event) => {
    event.stopPropagation();
    fileInput.click();
  });
  removeFileButton.addEventListener('click', clearFile);
  fileInput.addEventListener('change', () => setFile(fileInput.files?.[0]));

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('border-primary', 'bg-primary/10');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('border-primary', 'bg-primary/10');
  });

  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('border-primary', 'bg-primary/10');
    setFile(event.dataTransfer?.files?.[0]);
  });

  analyzeBtn.addEventListener('click', async () => {
    const { evidenceFile, evidenceNeedsReselection, claimType, textDescription, itemValue } = state.draftClaim;
    const description = textDescription.trim();
    const numericItemValue = Number(itemValue || 0);

    submitError.classList.add('hidden');
    submitError.textContent = '';
    clearFileError();
    clearItemValueError();

    if (!evidenceFile || evidenceNeedsReselection) {
      fileError.textContent = evidenceNeedsReselection
        ? 'Please re-attach the evidence file restored from your previous draft before continuing.'
        : 'Please choose one evidence file before continuing.';
      fileError.classList.remove('hidden');
      return;
    }

    if (numericItemValue <= 0) {
      itemValueError.textContent = 'Please enter a valid item value in Rupiah.';
      itemValueError.classList.remove('hidden');
      return;
    }

    if (!description) {
      submitError.textContent = 'Please write a short problem description before starting analysis.';
      submitError.classList.remove('hidden');
      return;
    }

    try {
      setSubmitState('uploading', 'Uploading evidence asset to backend storage...');
      const uploaded = await uploadEvidence(evidenceFile);

      setSubmitState('creating', 'Creating claim record for the demo user...');
      const createdClaim = await createClaim({
        user_id: state.currentUserId,
        order_id: `order_${Date.now()}`,
        claim_type: claimType,
        file_ids: [uploaded.file_id],
        text_description: description,
        item_value: numericItemValue,
        refund_amount: numericItemValue
      });

      setCurrentClaim(createdClaim);
      setCurrentClaimStatus({
        claim_id: createdClaim.id,
        status: createdClaim.status,
        current_step: createdClaim.current_step,
        updated_at: createdClaim.updated_at
      });

      setSubmitState('starting', 'Starting backend analysis workflow...');
      await analyzeClaim(createdClaim.id);
      navigate('analysis');
    } catch (error) {
      setSubmitState('idle');
      submitError.textContent = error.message || 'Failed to submit claim. Make sure backend is running.';
      submitError.classList.remove('hidden');
    }
  });

  return container;
}
