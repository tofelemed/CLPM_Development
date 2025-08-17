import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class DiagnosticsService {
  constructor(private http: HttpService) {}

  async run(loopId: string, payload: any) {
    const url = process.env.DIAG_SERVICE_URL || 'http://diagnostics:8050';
    const response = await firstValueFrom(this.http.post(`${url}/diagnostics/run`, { loop_id: loopId, ...payload }));
    return response.data;
  }
}
