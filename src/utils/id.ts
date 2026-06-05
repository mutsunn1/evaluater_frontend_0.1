import { v4 as uuidv4 } from 'uuid';

/** 生成前端会话内使用的客户端 ID，避免依赖部分移动端缺失的 crypto.randomUUID。 */
export function createClientId(): string {
  return uuidv4();
}
