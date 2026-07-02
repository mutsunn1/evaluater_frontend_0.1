<template>
  <div v-if="hasData" class="relative w-full">
    <Radar :data="chartData" :options="chartOptions" />
  </div>
  <div
    v-else
    class="flex h-32 items-center justify-center rounded-xl border border-dashed text-xs"
    :class="
      variant === 'dark'
        ? 'border-gray-700 text-gray-500'
        : 'border-gray-300 text-gray-400'
    "
  >
    {{ $t("profile.radarNoData") }}
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Radar } from "vue-chartjs";
import type { UserProfileData } from "@/types";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const props = withDefaults(
  defineProps<{
    skillLevels: NonNullable<UserProfileData["skill_levels"]>;
    variant?: "dark" | "light";
  }>(),
  { variant: "dark" }
);

const { t } = useI18n();

const dimensions: {
  key: "vocabulary" | "grammar" | "reading" | "listening" | "speaking";
  color: string;
}[] = [
  { key: "vocabulary", color: "#a855f7" },
  { key: "grammar", color: "#22c55e" },
  { key: "reading", color: "#f97316" },
  { key: "listening", color: "#ec4899" },
  { key: "speaking", color: "#06b6d4" },
];

const hasData = computed(() =>
  dimensions.some((d) => (props.skillLevels[d.key] ?? 0) > 0)
);

const isDark = computed(() => props.variant === "dark");

const chartData = computed<ChartData<"radar">>(() => {
  return {
    labels: dimensions.map((d) => t(`profile.skills.${d.key}`)),
    datasets: [
      {
        label: t("profile.skills.hsk"),
        data: dimensions.map((d) => props.skillLevels[d.key] ?? 0),
        backgroundColor: isDark.value
          ? "rgba(59, 130, 246, 0.18)"
          : "rgba(59, 130, 246, 0.14)",
        borderColor: "#3b82f6",
        pointBackgroundColor: dimensions.map((d) => d.color),
        pointBorderColor: isDark.value ? "#111827" : "#ffffff",
        pointHoverBackgroundColor: "#ffffff",
        pointHoverBorderColor: "#3b82f6",
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBorderWidth: 2,
        tension: 0.35,
      },
    ],
  };
});

const chartOptions = computed<ChartOptions<"radar">>(() => ({
  responsive: true,
  maintainAspectRatio: true,
  animation: {
    duration: 900,
    easing: "easeOutQuart",
  },
  scales: {
    r: {
      min: 0,
      max: 100,
      ticks: {
        stepSize: 20,
        backdropColor: "transparent",
        color: isDark.value ? "rgba(156, 163, 175, 0.7)" : "rgba(107, 114, 128, 0.8)",
        font: { size: 10 },
      },
      grid: {
        color: isDark.value ? "rgba(75, 85, 99, 0.35)" : "rgba(209, 213, 219, 0.6)",
      },
      angleLines: {
        color: isDark.value ? "rgba(75, 85, 99, 0.25)" : "rgba(209, 213, 219, 0.4)",
      },
      pointLabels: {
        color: isDark.value ? "rgba(209, 213, 219, 0.9)" : "rgba(75, 85, 99, 1)",
        font: {
          size: 11,
          weight: 500,
        },
      },
    },
  },
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: isDark.value ? "rgba(17, 24, 39, 0.92)" : "rgba(255, 255, 255, 0.96)",
      titleColor: isDark.value ? "#ffffff" : "#111827",
      bodyColor: isDark.value ? "#ffffff" : "#374151",
      borderColor: isDark.value ? "rgba(75, 85, 99, 0.6)" : "rgba(209, 213, 219, 1)",
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8,
      displayColors: false,
      callbacks: {
        label: (context) => `${context.dataset.label}: ${context.raw}%`,
      },
    },
  },
}));
</script>
