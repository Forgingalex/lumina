import type { LocalCurrencyQuote } from '../../types'
import { CELO_MAINNET } from './constants'

const localStableTokens = {
  NGN: {
    token: '0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71',
    decimals: 18,
  },
  KES: {
    token: '0x456a3D042C0DbD3db53D5489e98dFb038553B0d0',
    decimals: 18,
  },
  BRL: {
    token: '0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787',
    decimals: 18,
  },
} as const

export const fetchMentoLocalParity = async (rpcUrl: string): Promise<LocalCurrencyQuote[]> => {
  const { Mento, ChainId } = await import('@mento-protocol/mento-sdk')
  const mento = await Mento.create(ChainId.CELO, rpcUrl)
  const oneUsd = 1_000_000_000_000_000_000n

  const currencies = Object.keys(localStableTokens) as Array<keyof typeof localStableTokens>
  return Promise.all(
    currencies.map(async (currency) => {
      const token = localStableTokens[currency]
      const route = await mento.routes.findRoute(CELO_MAINNET.USDm_TOKEN, token.token)
      const amountOut = await mento.quotes.getAmountOut(CELO_MAINNET.USDm_TOKEN, token.token, oneUsd, route)

      return {
        currency,
        token: token.token,
        amountOut,
        decimals: token.decimals,
        quotedAt: new Date().toISOString(),
      } satisfies LocalCurrencyQuote
    })
  )
}
