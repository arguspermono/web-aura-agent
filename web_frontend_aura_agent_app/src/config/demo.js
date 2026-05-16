export const DEMO_USER_ID = 'user_001';
export const CLAIM_DRAFT_STORAGE_KEY = 'aura-demo-claim-draft-v1';
export const DEFAULT_DRAFT_CLAIM = {
  claimType: 'product_defect',
  textDescription: '',
  evidenceFile: null,
  evidencePreviewName: '',
  evidencePreviewUrl: '',
  evidenceMimeType: '',
  evidenceNeedsReselection: false,
  itemValue: null,
  refundAmount: 250000
};

export function loadDraftClaim() {
  try {
    const raw = window.localStorage.getItem(CLAIM_DRAFT_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_DRAFT_CLAIM };
    }

    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_DRAFT_CLAIM,
      ...parsed,
      evidenceFile: null,
      evidencePreviewUrl: '',
      evidenceMimeType: '',
      evidenceNeedsReselection: Boolean(parsed?.evidencePreviewName)
    };
  } catch {
    return { ...DEFAULT_DRAFT_CLAIM };
  }
}

export function persistDraftClaim(draftClaim) {
  window.localStorage.setItem(
    CLAIM_DRAFT_STORAGE_KEY,
    JSON.stringify({
      claimType: draftClaim.claimType,
      textDescription: draftClaim.textDescription,
      evidencePreviewName: draftClaim.evidencePreviewName,
      itemValue: draftClaim.itemValue,
      refundAmount: draftClaim.refundAmount
    })
  );
}

export function clearDraftClaimPersistence() {
  window.localStorage.removeItem(CLAIM_DRAFT_STORAGE_KEY);
}
