import { randomBytes } from 'node:crypto'
import type { Meeting } from '../../shared/contracts'

export class VdoNinjaBridge {
  createRoom(): Meeting {
    // Hex is accepted by VDO.Ninja's alphanumeric room IDs and gives 160 bits of entropy.
    const roomId = randomBytes(20).toString('hex')
    const password = randomBytes(16).toString('hex')
    const guest = new URL('https://vdo.ninja/')
    guest.searchParams.set('room', roomId)
    guest.searchParams.set('password', password)
    const director = new URL(guest)
    director.searchParams.set('director', roomId)
    director.searchParams.set('requireapproval', '')

    return {
      roomId,
      guestUrl: guest.toString(),
      directorUrl: director.toString(),
      invitation: `Entre na reunião VALE STREAM STUDIO: ${guest.toString()}`,
      provider: 'VDO.Ninja',
      limitations: 'A sala é fornecida pelo VDO.Ninja. Internet, navegador compatível e disponibilidade do provedor são necessários; o aplicativo não hospeda sinalização própria.'
    }
  }
}
