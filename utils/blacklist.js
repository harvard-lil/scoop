import { Address4, Address6 } from '@laverdet/beaugunderson-ip-address'

export function castBlacklistItem (val) {
  if(![String, RegExp].includes(val.constructor)) {
    throw new Error('Blacklist items may only be strings or regular expressions.')
  }

  if(val instanceof RegExp){
    return val
  }

  try {
    return new Address4(val)
  } catch {}

  try {
    return new Address6(val)
  } catch {}

  return val
}

function testMatch (test) {
  return (val) => {
    if([Address4, Address6].includes(test.constructor)){
      return val.isInSubnet?.(test)
    }

    return val.match?.(test)
  }
}

export function searchBlacklistFor (...args) {
  const toTest = args.map(castBlacklistItem)
  return (blacklistItem) => toTest.find(testMatch(blacklistItem))
}
