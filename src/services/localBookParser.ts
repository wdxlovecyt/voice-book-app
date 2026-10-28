export type LocalChapter = { title: string; content: string };

export function splitLocalBook(rawContent: string): LocalChapter[] {
  const content = rawContent.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!content) throw new Error('该文本文件没有可阅读的内容。');

  const chapters: LocalChapter[] = [];
  let title: string | null = null;
  let lines: string[] = [];
  let hasBody = false;
  const isHeading = (line: string) => {
    const text = line.trim().normalize('NFKC');
    if (text.length > 80 || /[。！？!?；;]/u.test(text)) return false;
    return /^(?:正文\s+)?第\s*[0-9零〇一二三四五六七八九十百千万两壹贰叁肆伍陆柒捌玖拾佰仟]+\s*[章回节卷部篇](?:[\s:：、.．—-].*)?$/u.test(text)
      || /^chapter\s+(?:\d+|[ivxlcdm]+)(?:[\s:：.\-].*)?$/iu.test(text)
      || /^(?:序章|序言|前言|楔子|引子|引言|尾声|终章|后记|後記|番外)(?:[\s:：].*)?$/u.test(text);
  };

  for (const line of content.split('\n')) {
    if (isHeading(line)) {
      if (hasBody) {
        chapters.push({ title: title ?? '前言', content: lines.join('\n').trim() });
        lines = [];
      } else if (title) {
        // 连续卷名、章名或目录行没有正文时，不生成空章节。
        lines.push(title);
      }
      title = line.trim();
      hasBody = false;
    } else {
      lines.push(line);
      hasBody ||= Boolean(line.trim());
    }
  }

  if (!hasBody && title) {
    if (!chapters.length) return [{ title: '正文', content }];
    chapters[chapters.length - 1].content += '\n\n' + [...lines, title].join('\n').trim();
  } else {
    chapters.push({ title: title ?? '正文', content: lines.join('\n').trim() });
  }
  return chapters;
}
