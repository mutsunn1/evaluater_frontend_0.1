<template>
  <div
    class="upload-placeholder my-3 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center"
    data-testid="upload-drop-zone"
  >
    <div class="text-4xl mb-2">📁</div>
    <p class="text-sm text-gray-600 font-medium">
      {{ $t("chat.upload.click") }}
    </p>
    <p class="text-xs text-gray-400 mt-1">{{ $t("chat.upload.notScored") }}</p>
    <button
      class="btn-secondary mt-3 px-4 py-1.5 text-sm"
      disabled
      data-testid="upload-btn"
    >
      {{ $t("chat.upload.comingSoon") }}
    </button>
  </div>
</template>
