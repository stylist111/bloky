export const translateDummy = (content, subsitution) => {
  const pattern = /\[\[|\]\]/; // matches [[ or ]]
  const [before, inner, after] = content.split(pattern);

  return `${before} [[${subsitution || inner}]] ${after}`;
};
