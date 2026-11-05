import { describe, expect, it } from 'vitest'
import { VdoNinjaBridge } from '../electron/services/VdoNinjaBridge'

describe('VdoNinjaBridge', () => {
  it('creates different guest and director room URLs with enough entropy', () => {
    const meeting = new VdoNinjaBridge().createRoom()
    const guest = new URL(meeting.guestUrl)
    const director = new URL(meeting.directorUrl)

    expect(meeting.roomId).toMatch(/^[a-f0-9]{40}$/)
    expect(guest.searchParams.get('room')).toBe(meeting.roomId)
    expect(guest.searchParams.get('password')).toMatch(/^[a-f0-9]{32}$/)
    expect(director.searchParams.get('director')).toBe(meeting.roomId)
    expect(director.searchParams.has('requireapproval')).toBe(true)
    expect(meeting.guestUrl).not.toBe(meeting.directorUrl)
  })
})
