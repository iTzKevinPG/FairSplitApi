export interface BalanceDTO {
  personId: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

export interface SettlementTransferDTO {
  fromPersonId: string;
  toPersonId: string;
  amount: number;
}

export interface SettlementDTO {
  balances: BalanceDTO[];
  transfers: SettlementTransferDTO[];
}
