import React from 'react';
import './App.css';
import CloudPanoramaPositionDemo from "./Demo";
import styled from "styled-components";
import 'antd/dist/antd.css'; // 核心
const Warp = styled.div`
    width: 100vw;
    height: 100vh;
    position: relative;
    overflow: hidden;
`;
function App() {
  return <Warp>
    <CloudPanoramaPositionDemo />
  </Warp>;
}

export default App;
