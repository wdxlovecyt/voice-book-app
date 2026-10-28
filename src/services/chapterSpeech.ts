import { synthesizeSpeech, type TtsAudio } from './tts';

const API_BASE_URL = 'https://huangwu.xin';
const MAX_ROLE_ANALYSIS_BATCH_SIZE = 5;
const ROLE_ANALYSIS_CONCURRENCY = 3;

export type ChapterRoleSegment = {
  type: 0 | 1 | 2;
  speaker: string;
  gender: 'male' | 'female' | 'unknown';
  text: string;
};

type RoleAnalysisResponse = {
  segments: ChapterRoleSegment[];
};

type RoleBatchHandler = (segments: ChapterRoleSegment[]) => void;

export type ChapterSpeechSegment = ChapterRoleSegment & {
  audio: TtsAudio;
};

async function analyzeRoleBatch(
  content: string,
): Promise<ChapterRoleSegment[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/novels/analyze-roles`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: content }),
    },
  );

  if (!response.ok) {
    throw new Error(`角色分析失败：${response.status}`);
  }

  const result = (await response.json()) as RoleAnalysisResponse;

  if (!Array.isArray(result.segments) || result.segments.length === 0) {
    throw new Error('角色分析未返回可朗读的正文分段。');
  }

  return result.segments;
}

export async function analyzeChapterRoles(
  content: string,
  onBatch?: RoleBatchHandler,
): Promise<ChapterRoleSegment[]> {
  const paragraphs = content
    .split(/\r?\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    throw new Error('章节正文为空，无法进行角色分析。');
  }

  const batches: string[] = [];
  let startIndex = 0;
  let batchSize = 1;

  while (startIndex < paragraphs.length) {
    batches.push(
      paragraphs
        .slice(startIndex, startIndex + batchSize)
        .join('\n'),
    );
    startIndex += batchSize;
    batchSize = Math.min(batchSize + 1, MAX_ROLE_ANALYSIS_BATCH_SIZE);
  }

  const segments: ChapterRoleSegment[] = [];
  const batchResults: Array<ChapterRoleSegment[] | undefined> = [];
  let nextBatchIndex = 0;
  let nextResultIndex = 0;

  function flushOrderedResults() {
    while (true) {
      const batchSegments = batchResults[nextResultIndex];
      if (!batchSegments) {
        return;
      }

      batchResults[nextResultIndex] = undefined;
      nextResultIndex += 1;
      segments.push(...batchSegments);
      onBatch?.(batchSegments);
    }
  }

  async function analyzeWorker() {
    while (nextBatchIndex < batches.length) {
      const batchIndex = nextBatchIndex;
      nextBatchIndex += 1;

      batchResults[batchIndex] = await analyzeRoleBatch(batches[batchIndex]);
      flushOrderedResults();
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(ROLE_ANALYSIS_CONCURRENCY, batches.length) },
      analyzeWorker,
    ),
  );

  return segments;
}

export async function synthesizeChapterSegment(
  segment: ChapterRoleSegment,
  voice: string,
): Promise<ChapterSpeechSegment> {
  return {
    ...segment,
    audio: await synthesizeSpeech({
      text: segment.text,
      voice,
      rate: '+0%',
      pitch: '+0Hz',
    }),
  };
}
