<template>
  <div
    class="handwriting-placeholder my-3 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center"
    data-testid="handwriting-canvas"
    data-hanzi-writer-target="true"
  >
    <div class="text-4xl mb-2">✍️</div>
    <p class="text-sm text-gray-600 font-medium">
      {{ $t("chat.handwriting.area") }}
    </p>
    <p class="text-xs text-gray-400 mt-1">
      {{ $t("chat.handwriting.notScored") }}
    </p>
    <div
      class="mx-auto mt-3 h-20 w-40 rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-400"
    >
      {{ $t("chat.handwriting.panel") }}
    </div>
  </div>
</template>
