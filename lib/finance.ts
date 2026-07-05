import type { Transaction } from '@/lib/types/database'

type AmountLike = Pick<Transaction, 'amount' | 'type'>

// Sum of expense amounts only — income/transfer/adjustment rows are ignored
export function sumExpenses(transactions: readonly AmountLike[]): number {
  return transactions.reduce(
    (total, t) => (t.type === 'expense' ? total + t.amount : total),
    0,
  )
}
