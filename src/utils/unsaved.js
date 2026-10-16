// What would actually be written for a lesson: a trimmed note, and "online" only counts for P / L
const clean = (status, note) => ({
  comment: ((note && note.comment) || '').trim(),
  online: status === 'A' ? false : Boolean(note && note.online)
})

// True when a lesson's status or note differs from what is saved in the database
export function lessonHasUnsaved(status, note, savedStatus, savedNote) {
  const current = clean(status, note)
  const saved = clean(savedStatus, savedNote)
  return (
    (status || null) !== (savedStatus || null) ||
    current.comment !== saved.comment ||
    current.online !== saved.online
  )
}