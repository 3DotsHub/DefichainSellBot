import { Injectable } from '@nestjs/common';
import { WhaleApiClient } from '@defichain/whale-api-client';

@Injectable()
export class Ocean extends WhaleApiClient {}
