package com.bigbulls.globalmarket;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(BigbullsUpdaterPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
