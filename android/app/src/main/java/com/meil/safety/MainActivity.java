package com.meil.safety;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }
    
    @Override
    public void onBackPressed() {
        // Move app to background instead of closing it
        // This allows the app to resume from where the user left off
        moveTaskToBack(true);
    }
}
