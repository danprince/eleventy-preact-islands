import { FC } from "preact/compat";
import { useState } from "preact/hooks";

let Counter: FC<{ count?: number }> = ({ count: initialCount = 0 }) => {
  let [count, setCount] = useState(initialCount);
  let inc = () => setCount(n => n + 1);
  let dec = () => setCount(n => n - 1);
  return (
    <>
      <button onClick={dec}>-</button>
      <span>{count}</span>
      <button onClick={inc}>+</button>
    </>
  );
};

export default Counter;
