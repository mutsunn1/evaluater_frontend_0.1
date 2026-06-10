<template>
  <div
    class="speech-placeholder my-3 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center"
  >
    <div class="text-4xl mb-2">🎙️</div>
    <p class="text-sm text-gray-600 font-medium">点击录音</p>
    <p class="text-xs text-gray-400 mt-1">语音作答（暂不支持自动评分）</p>
    <button
      class="btn-primary mt-3 px-4 py-1.5 text-sm"
      disabled
      data-testid="speech-record-btn"
    >
      录音（即将支持）
    </button>
  </div>
</template>
