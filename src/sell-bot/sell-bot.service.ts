import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Ocean } from 'src/ocean/ocean.api.service';
import { Wallet } from 'src/ocean/ocean.wallet.service';

@Injectable()
export class SellBotService {
	private readonly logger = new Logger(this.constructor.name);
	private running: boolean = false;

	constructor(private ocean: Ocean, private wallet: Wallet) {}

	@Interval(5000)
	async sellAction() {
		if (this.running) return;
		this.running = true;

		try {
			this.logger.log('hi');
			// check for utxo?
			// check if swappable token is available
			// make tx, swap, send to addr
			// submit

			// show updated
			this.logger.log('Blockheight updated: ');
		} catch (error) {
			this.logger.error(error);
			this.running = false;
		}

		this.running = false;
	}
}
