export class ChainInfo {
  public updatedAt: number = 0;

  constructor(public chainId: string, public version: string) {
    this.updatedAt = Date.now();
  }

  public getChainSummary() {
    return {
      chainId: this.chainId,
      version: this.version,
    };
  }
}

export type BlockData = {
  timestamp: number;
  hash: string;
  success: boolean;
  events: {
    name: string;
    data: any;
  }[];
};
