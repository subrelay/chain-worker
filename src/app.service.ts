import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { QueueService } from 'nestjs-queue';
import { ChainInfo } from './chain';
import { EventRecord } from '@polkadot/types/interfaces';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);
  private api: ApiPromise;
  private chainInfo: ChainInfo;

  public constructor(
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const wsProvider = new WsProvider(this.configService.get('CHAIN_RPC'));
    this.api = await ApiPromise.create({ provider: wsProvider });
    await this.setChainInfo();
    await this.start();
  }

  public async setChainInfo(hash?: string): Promise<void> {
    const currentHash =
      hash || (await this.api.rpc.chain.getBlock()).block.hash.toString();

    const apiAt = await this.api.at(currentHash);
    this.chainInfo = new ChainInfo(
      apiAt.runtimeVersion.specName.toString(),
      apiAt.runtimeVersion.specVersion.toNumber().toString(),
    );
  }

  public async start() {
    const _ = await this.api.rpc.chain.subscribeFinalizedHeads(
      async (lastHeader) => {
        this.logger.debug(
          `${this.chainInfo.chainId}_${this.chainInfo.version} ---> Processing block ${lastHeader.hash}`,
        );

        const data = await this.parseBlock(lastHeader.hash.toString());
        await this.queueService.send('block', { id: data.id, body: data });
      },
    );
  }

  private async parseBlock(hash: string) {
    const [signedBlock, apiAt] = await Promise.all([
      this.api.rpc.chain.getBlock(hash),
      this.api.at(hash),
    ]);

    const {
      extrinsics,
      registry: {
        metadata: {},
      },
    } = signedBlock.block || {};

    const version = apiAt.runtimeVersion.specVersion.toNumber().toString();
    if (this.chainInfo.version !== version) {
      await this.setChainInfo(hash);
    }

    const timestampArgs = extrinsics
      .map((e) => e.method)
      .find((m) => m.section === 'timestamp' && m.method === 'set');
    const timestamp = Number(timestampArgs?.args[0].toString()) || Date.now();

    const eventRecords =
      (await apiAt.query.system.events()) as unknown as EventRecord[];

    let success = true;
    extrinsics.forEach((_, index) => {
      eventRecords
        .filter(
          ({ phase }) =>
            phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index),
        )
        .forEach(({ event }) => {
          success = this.api.events.system.ExtrinsicSuccess.is(event) || false;
        });
    });

    return {
      id: `${this.chainInfo.chainId}_${this.chainInfo.version}_${hash}`,
      timestamp,
      hash,
      success,
      events: eventRecords.map((record) => ({
        name: `${record.event.section}.${record.event.method}`,
        data: record.event.data,
      })),
    };
  }
}
