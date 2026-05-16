import { navigate, setCurrentClaim, setCurrentClaimStatus, state } from '../main.js';
import { getClaim, getClaimStatus } from '../services/api_service.js';

export function renderAiAnalysis() {
  const container = document.createElement('div');
  container.className = 'w-full max-w-md mx-auto flex flex-col pb-6';
  const minVisibleMs = 2800;
  const startedAt = Date.now();
  
  container.innerHTML = `
    <!-- Progress Header -->
    <div class="flex flex-col gap-sm mt-sm">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-1">
    <h2 class="font-headline-md text-headline-md text-on-background m-0">AI Analysis</h2>
    <span class="font-label-caps text-label-caps text-primary uppercase tracking-widest">Step 2 of 3</span>
    </div>
    <!-- Progress Tracker -->
    <div class="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden relative">
    <div id="progress-bar" class="h-full bg-gradient-to-r from-primary-fixed-dim to-primary rounded-full w-[8%] relative overflow-hidden transition-all duration-700">
    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent w-full -translate-x-1/2"></div>
    </div>
    </div>
    </div>
    <!-- Central Glowing Graphic (Level 1 Depth) -->
    <div class="bg-surface-container-low rounded-xl p-lg flex flex-col items-center justify-center relative min-h-[220px] border border-outline-variant/30 mt-8">
    <!-- Dual Track Rings -->
    <div class="absolute w-[140px] h-[140px] rounded-full border-[3px] border-primary/10"></div>
    <div class="absolute w-[140px] h-[140px] rounded-full border-[3px] border-transparent border-t-primary border-r-primary/50 rotate-[45deg] blur-[1px] animate-[spin_3s_linear_infinite]"></div>
    <!-- Luminous Center -->
    <div class="relative z-10 flex items-center justify-center">
    <div class="absolute inset-0 bg-primary/10 rounded-full blur-[24px] scale-150 animate-pulse"></div>
    <span class="material-symbols-outlined text-[64px] text-primary relative z-20">neurology</span>
    </div>
    </div>
    <!-- Vertical Checklist (Level 2 Depth) -->
    <div class="bg-surface-container rounded-xl p-md flex flex-col gap-md border border-outline-variant/30 mt-8">
    <!-- Complete Step -->
    <div class="flex items-start gap-md sm:items-center" id="step-uploading">
    <span class="material-symbols-outlined text-secondary step-icon" style="font-variation-settings: 'FILL' 1;">check_circle</span>
    <div class="flex-1 flex justify-between items-center border-b border-outline-variant/20 pb-2">
    <span class="font-body-md text-body-md text-on-surface step-title">Uploading Evidence</span>
    <span class="font-label-caps text-label-caps text-secondary step-status">Complete</span>
    </div>
    </div>
    <!-- Active Step -->
    <div class="flex items-start gap-md relative sm:items-center opacity-60 transition-opacity" id="step-analyzing">
    <!-- Outer Bloom -->
    <div class="absolute -left-2 -right-2 top-1 bottom-1 bg-primary/5 rounded-lg blur-md"></div>
    <span class="material-symbols-outlined text-on-surface-variant relative z-10 step-icon">radio_button_unchecked</span>
    <div class="flex-1 flex justify-between items-center relative z-10 border-b border-outline-variant/20 pb-2">
    <span class="font-body-md text-body-md text-on-surface-variant step-title">Analyzing Evidence</span>
    <span class="font-label-caps text-label-caps text-on-surface-variant step-status">Pending</span>
    </div>
    </div>
    <!-- Pending Step 1 -->
    <div class="flex items-start gap-md opacity-60 transition-opacity sm:items-center" id="step-detecting">
    <span class="material-symbols-outlined text-on-surface-variant step-icon">radio_button_unchecked</span>
    <div class="flex-1 flex justify-between items-center border-b border-outline-variant/20 pb-2">
    <span class="font-body-md text-body-md text-on-surface-variant step-title">Detecting Damage Patterns</span>
    <span class="font-label-caps text-label-caps text-on-surface-variant step-status">Pending</span>
    </div>
    </div>
    <!-- Pending Step 2 -->
    <div class="flex items-start gap-md opacity-60 transition-opacity sm:items-center" id="step-calculating">
    <span class="material-symbols-outlined text-on-surface-variant step-icon">radio_button_unchecked</span>
    <div class="flex-1 flex justify-between items-center border-b border-outline-variant/20 pb-2">
    <span class="font-body-md text-body-md text-on-surface-variant step-title">Calculating Confidence Score</span>
    <span class="font-label-caps text-label-caps text-on-surface-variant step-status">Pending</span>
    </div>
    </div>
    <!-- Pending Step 3 -->
    <div class="flex items-start gap-md opacity-60 transition-opacity sm:items-center" id="step-generating">
    <span class="material-symbols-outlined text-on-surface-variant step-icon">radio_button_unchecked</span>
    <div class="flex-1 flex justify-between items-center">
    <span class="font-body-md text-body-md text-on-surface-variant step-title">Generating Report</span>
    <span class="font-label-caps text-label-caps text-on-surface-variant step-status">Pending</span>
    </div>
    </div>
    </div>
    <!-- Live Status Terminal -->
    <div class="bg-surface-container-high border border-outline-variant/30 rounded-lg p-md font-mono text-xs text-on-surface-variant flex flex-col gap-2 overflow-hidden relative shadow-sm mt-8">
    <div class="flex gap-2">
    <span class="text-outline">&gt;</span>
    <span id="analysis-log-primary" class="text-on-surface-variant">Waiting for backend analysis pipeline...</span>
    </div>
    <div class="flex gap-2" id="term-2" style="display:none;">
    <span class="text-outline">&gt;</span>
    <span id="analysis-log-secondary" class="text-on-surface-variant">Polling claim status endpoint...</span>
    </div>
    <div class="flex gap-2 text-primary">
    <span class="text-primary">&gt;</span>
    <span id="analysis-log-active" class="font-medium tracking-wide">Connecting to backend...</span>
    <span class="w-1.5 h-3.5 bg-primary inline-block align-middle ml-1 mt-0.5 animate-pulse"></span>
    </div>
    </div>
    <div id="analysis-error" class="hidden rounded-xl border border-error/20 bg-error-container/50 p-4 text-body-sm text-on-error-container mt-6"></div>
    <button id="analysis-retry-btn" class="hidden mt-4 w-full rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-body-md font-medium text-primary hover:bg-primary/15">
      Back to Create Claim
    </button>
  `;

  const claimId = state.currentClaim?.id;
  const progressBar = container.querySelector('#progress-bar');
  const errorBox = container.querySelector('#analysis-error');
  const secondaryLog = container.querySelector('#term-2');
  const activeLog = container.querySelector('#analysis-log-active');
  const primaryLog = container.querySelector('#analysis-log-primary');
  const secondaryLogText = container.querySelector('#analysis-log-secondary');
  const retryButton = container.querySelector('#analysis-retry-btn');

  const stepOrder = [
    'uploading_evidence',
    'analyzing_evidence',
    'detecting_damage_patterns',
    'calculating_confidence_score',
    'generating_report',
    'complete'
  ];

  const stepMap = {
    uploading_evidence: container.querySelector('#step-uploading'),
    analyzing_evidence: container.querySelector('#step-analyzing'),
    detecting_damage_patterns: container.querySelector('#step-detecting'),
    calculating_confidence_score: container.querySelector('#step-calculating'),
    generating_report: container.querySelector('#step-generating')
  };

  const labels = {
    uploading_evidence: 'Uploading Evidence',
    analyzing_evidence: 'Analyzing Evidence',
    detecting_damage_patterns: 'Detecting Damage Patterns',
    calculating_confidence_score: 'Calculating Confidence Score',
    generating_report: 'Generating Report',
    complete: 'Complete',
    failed: 'Failed'
  };

  const stepLogs = {
    uploading_evidence: 'Verifying uploaded evidence package and metadata...',
    analyzing_evidence: 'Running multimodal reasoning against the evidence set...',
    detecting_damage_patterns: 'Cross-checking visible damage signals and claim context...',
    calculating_confidence_score: 'Computing decision confidence and refund recommendation...',
    generating_report: 'Writing final decision payload and explanation...',
    complete: 'Backend decision finalized. Preparing final report...',
    failed: 'Backend workflow returned a failure state.'
  };

  const markStepState = (element, mode) => {
    if (!element) return;
    const icon = element.querySelector('.step-icon');
    const title = element.querySelector('.step-title');
    const status = element.querySelector('.step-status');

    element.classList.remove('opacity-60');
    icon.className = 'material-symbols-outlined step-icon';
    title.className = 'font-body-md text-body-md step-title';
    status.className = 'font-label-caps text-label-caps step-status';

    if (mode === 'complete') {
      icon.textContent = 'check_circle';
      icon.classList.add('text-secondary');
      title.classList.add('text-on-surface');
      status.classList.add('text-secondary');
      status.textContent = 'Complete';
    } else if (mode === 'active') {
      icon.textContent = 'sync';
      icon.classList.add('text-primary', 'animate-spin');
      title.classList.add('text-primary', 'font-medium');
      status.classList.add('text-primary');
      status.textContent = 'Processing...';
    } else {
      element.classList.add('opacity-60');
      icon.textContent = 'radio_button_unchecked';
      icon.classList.add('text-on-surface-variant');
      title.classList.add('text-on-surface-variant');
      status.classList.add('text-on-surface-variant');
      status.textContent = 'Pending';
    }
  };

  const updateProgressUi = (statusPayload) => {
    const currentStep = statusPayload?.current_step || 'uploading_evidence';
    const currentIndex = Math.max(0, stepOrder.indexOf(currentStep));
    const progressValue = currentStep === 'complete'
      ? 100
      : Math.max(8, Math.round(((currentIndex + 1) / (stepOrder.length - 1)) * 100));

    progressBar.style.width = `${progressValue}%`;
    secondaryLog.style.display = 'flex';
    primaryLog.textContent = `Claim #${statusPayload.claim_id || claimId} is ${statusPayload.status || 'processing'}.`;
    secondaryLogText.textContent = `Current step: ${labels[currentStep] || currentStep}`;
    activeLog.textContent = stepLogs[currentStep] || `Executing ${labels[currentStep] || currentStep}...`;

    Object.entries(stepMap).forEach(([key, element]) => {
      if (statusPayload.status === 'failed') {
        markStepState(element, 'pending');
        return;
      }

      if (currentStep === 'complete') {
        markStepState(element, 'complete');
        return;
      }

      const index = stepOrder.indexOf(key);
      if (index < currentIndex) {
        markStepState(element, 'complete');
      } else if (key === currentStep) {
        markStepState(element, 'active');
      } else {
        markStepState(element, 'pending');
      }
    });
  };

  const showError = (message) => {
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
    activeLog.textContent = 'Analysis stopped.';
    retryButton.classList.remove('hidden');
  };

  if (!claimId) {
    showError('No active claim found. Please create a claim first.');
    return container;
  }

  let pollTimer = null;

  const stopPolling = () => {
    if (pollTimer) {
      clearTimeout(pollTimer);
    }
  };

  retryButton.addEventListener('click', () => {
    navigate('evidence');
  });

  const poll = async () => {
    try {
      const statusPayload = await getClaimStatus(claimId);
      setCurrentClaimStatus(statusPayload);
      updateProgressUi(statusPayload);

      if (statusPayload.status === 'approved' || statusPayload.status === 'review' || statusPayload.status === 'rejected') {
        const fullClaim = await getClaim(claimId);
        setCurrentClaim(fullClaim);
        const remainingMs = Math.max(0, minVisibleMs - (Date.now() - startedAt));
        activeLog.textContent = statusPayload.status === 'approved'
          ? 'Decision: auto-approved with refund recommendation ready.'
          : statusPayload.status === 'review'
            ? 'Decision: manual review required. Preparing summary for reviewer.'
            : 'Decision: rejected. Preparing explanation payload.';
        window.setTimeout(() => {
          navigate('decision');
        }, remainingMs);
        return;
      }

      if (statusPayload.status === 'failed') {
        stopPolling();
        const failedClaim = await getClaim(claimId);
        setCurrentClaim(failedClaim);
        showError(failedClaim.ai_explanation || 'Analysis failed on backend.');
        return;
      }

      pollTimer = window.setTimeout(poll, 1400);
    } catch (error) {
      stopPolling();
      showError(error.message || 'Failed to fetch claim status. Check whether backend is running.');
    }
  };

  poll();

  return container;
}
