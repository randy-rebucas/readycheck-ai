import { Body, Controller, Post } from "@nestjs/common";
import { scanRepository } from "@readycheck/scanner";
import { coreRules, evaluateRules } from "@readycheck/rules";
import { scoreIssues } from "@readycheck/scoring";

interface TriggerScanDto {
  path: string;
}

@Controller("scans")
export class ScansController {
  @Post()
  trigger(@Body() dto: TriggerScanDto) {
    const facts = scanRepository(dto.path);
    const issues = evaluateRules(coreRules, facts);
    const result = scoreIssues(issues);

    return { facts, issues, ...result };
  }
}
