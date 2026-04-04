export interface LetterboxMeta {
  scale: number
  padX: number
  padY: number
  origW: number
  origH: number
}

export interface Detection {
  x1: number
  y1: number
  x2: number
  y2: number
  confidence: number
  classId: number
}
