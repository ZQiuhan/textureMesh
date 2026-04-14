import React from 'react';
import './App.css';
import CloudPanoramaPositionDemo from "./Demo";
import styled from "styled-components";
import 'antd/dist/antd.css';
import Demo2 from "./Demo2";
import Demo3 from "./Demo3";
import Demo4 from "./Demo4"; // 核心
import Demo5 from "./Demo5"; // 核心
const Warp = styled.div`
    width: 100vw;
    height: 100vh;
    position: relative;
    overflow: hidden;
`;
function App() {
  return <Warp>
    {/*<CloudPanoramaPositionDemo />*/}
    {/*<Demo3/>*/}
    <Demo5/>
  </Warp>;
}

export default App;
