import type { LocalCurrencyQuote } from '../../types'

export * from './flow-core'

export const getMentoLocalParity = async (rpcUrl: string): Promise<LocalCurrencyQuote[]> => {
  const { fetchMentoLocalParity } = await import('./mento')
  return fetchMentoLocalParity(rpcUrl)
}
