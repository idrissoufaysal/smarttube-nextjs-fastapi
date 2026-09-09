export interface SegmentItem {
  text: string;
  start: number;
  duration: number;
}

export interface VideoInfo {
  title: string;
  description: string;
  author: string;
  viewCount: number;
  publishDate: string;
  duration: number;
  notes?: string | null;
  transcript?: string;
  segments?: SegmentItem[];
}
