"""Data generator for realistic control loop data based on CSV patterns."""

import random
import numpy as np
from typing import Dict, List, Any, Tuple
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class ControlLoopDataGenerator:
    """Generates realistic control loop data based on patterns from CSV file."""
    
    def __init__(self):
        """Initialize the data generator with default parameters."""
        # Base values from the CSV data analysis
        self.base_pv = 405.0  # Process Variable base value
        self.base_sp = 405.41  # Set Point base value  
        self.base_op = 63.5   # Output base value
        
        # Normal operation variation ranges (SMALL for stable operation)
        self.pv_variation_normal = 0.3  # Small variation during normal operation
        self.sp_variation_normal = 0.05  # Very small SP changes
        self.op_variation_normal = 0.4  # Small OP variations
        
        # Abnormal operation variation ranges (LARGE for disturbances)
        self.pv_variation_abnormal = 5.0  # Large PV swings during abnormal
        self.sp_variation_abnormal = 1.0  # Larger SP changes
        self.op_variation_abnormal = 8.0  # Large OP swings
        
        # Loop IDs to simulate (from CSV)
        self.loop_ids = ["TIC208030", "TIC208031", "TIC208032", "TIC208033", "TIC208034"]
        
        # Control modes
        self.modes = ["AUT", "MAN", "CAS"]
        
        # Noise parameters
        self.noise_std_normal = 0.02  # Small noise during normal operation
        self.noise_std_abnormal = 0.3  # Larger noise during abnormal operation
        
        # Abnormal behavior parameters
        self.normal_duration_seconds = 15 * 60  # 15 minutes of normal operation
        self.abnormal_duration_seconds = 5 * 60  # 5 minutes of abnormal operation
        self.cycle_duration_seconds = self.normal_duration_seconds + self.abnormal_duration_seconds  # Total cycle: 20 minutes
        self.oscillation_amplitude_abnormal = 4.0  # Large oscillations when abnormal
        self.oscillation_frequency_abnormal = 0.1  # Faster oscillations when abnormal
        
        # State tracking
        self.loop_states = {}  # Store state for each loop
        self.start_time = datetime.utcnow()  # Track when generator started
        self.time_counter = 0  # Global time counter
        
    def generate_loop_data(self, loop_id: str, timestamp: datetime = None) -> List[Dict[str, Any]]:
        """
        Generate data points that are normal for 15 minutes, then become abnormal.
        
        Args:
            loop_id: Loop identifier
            timestamp: Timestamp for the data (default: current time)
            
        Returns:
            List of data points for PV, OP, and SP
        """
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        # Initialize state for this loop if not exists
        if loop_id not in self.loop_states:
            self.loop_states[loop_id] = {
                'phase': random.uniform(0, 2 * np.pi),
                'last_trend': 0,
                'counter': 0,
                'start_time': datetime.utcnow()
            }
        
        state = self.loop_states[loop_id]
        state['counter'] += 1
        
        # Calculate elapsed time since start
        elapsed_seconds = (datetime.utcnow() - state['start_time']).total_seconds()
        
        # Calculate position in the cycle (20-minute cycle: 15 normal + 5 abnormal)
        position_in_cycle = elapsed_seconds % self.cycle_duration_seconds
        
        # Determine if we're in abnormal mode
        # Normal: 0-900 seconds (0-15 minutes)
        # Abnormal: 900-1200 seconds (15-20 minutes)
        is_abnormal = position_in_cycle >= self.normal_duration_seconds
        
        if is_abnormal:
            # ABNORMAL MODE: Large fluctuations, oscillations, disturbances
            time_in_abnormal = position_in_cycle - self.normal_duration_seconds
            pv_value = self._generate_abnormal_value(
                self.base_pv, self.pv_variation_abnormal, state['counter'], state['phase']
            )
            sp_value = self._generate_abnormal_value(
                self.base_sp, self.sp_variation_abnormal, state['counter'], state['phase'] + 0.5
            )
            op_value = self._generate_abnormal_value(
                self.base_op, self.op_variation_abnormal, state['counter'], state['phase'] + 1.0
            )
            logger.debug(f"Loop {loop_id}: ABNORMAL mode - {time_in_abnormal:.0f}s into abnormal phase")
        else:
            # NORMAL MODE: Small, stable variations
            pv_value = self._generate_normal_value(self.base_pv, self.pv_variation_normal)
            sp_value = self._generate_normal_value(self.base_sp, self.sp_variation_normal)
            op_value = self._generate_normal_value(self.base_op, self.op_variation_normal)
            logger.debug(f"Loop {loop_id}: NORMAL mode - {position_in_cycle:.0f}s into cycle")
        
        # Select mode (mostly AUT, occasionally others)
        mode = random.choices(self.modes, weights=[0.8, 0.15, 0.05])[0]
        
        data_points = [
            {
                "_time": timestamp,
                "loop_id": loop_id,
                "_field": "PV",
                "_value": pv_value,
                "Mode": mode,
                "_measurement": "control_loops"
            },
            {
                "_time": timestamp,
                "loop_id": loop_id,
                "_field": "OP", 
                "_value": op_value,
                "Mode": mode,
                "_measurement": "control_loops"
            },
            {
                "_time": timestamp,
                "loop_id": loop_id,
                "_field": "SP",
                "_value": sp_value,
                "Mode": mode,
                "_measurement": "control_loops"
            }
        ]
        
        return data_points
    
    def generate_multiple_loops(self, timestamp: datetime = None) -> List[Dict[str, Any]]:
        """
        Generate data for multiple control loops.
        
        Args:
            timestamp: Timestamp for the data (default: current time)
            
        Returns:
            List of data points for all loops
        """
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        all_data = []
        for loop_id in self.loop_ids:
            loop_data = self.generate_loop_data(loop_id, timestamp)
            all_data.extend(loop_data)
        
        return all_data
    
    def generate_trending_data(self, loop_id: str, start_time: datetime, 
                             duration_minutes: int = 5, interval_seconds: int = 1) -> List[Dict[str, Any]]:
        """
        Generate trending data: normal for 15 minutes, then abnormal.
        
        Args:
            loop_id: Loop identifier
            start_time: Start time for the trend
            duration_minutes: Duration in minutes
            interval_seconds: Interval between data points in seconds
            
        Returns:
            List of data points over time
        """
        all_data = []
        
        # Initialize state for this loop if not exists
        if loop_id not in self.loop_states:
            self.loop_states[loop_id] = {
                'phase': random.uniform(0, 2 * np.pi),
                'last_trend': 0,
                'counter': 0,
                'start_time': start_time
            }
        
        state = self.loop_states[loop_id]
        
        # Create a trending pattern
        trend_points = int(duration_minutes * 60 / interval_seconds)
        
        # Generate time points
        time_points = np.linspace(0, duration_minutes * 60, trend_points)
        
        for i, time_offset in enumerate(time_points):
            timestamp = start_time + timedelta(seconds=time_offset)
            
            # Calculate position in the cycle for this time point
            position_in_cycle = time_offset % self.cycle_duration_seconds
            
            # Determine if this point is in abnormal mode
            # Normal: 0-900 seconds (0-15 minutes)
            # Abnormal: 900-1200 seconds (15-20 minutes)
            is_abnormal = position_in_cycle >= self.normal_duration_seconds
            
            if is_abnormal:
                # ABNORMAL: Large fluctuations
                pv_value = self._generate_abnormal_value(
                    self.base_pv, self.pv_variation_abnormal, state['counter'] + i, state['phase']
                )
                sp_value = self._generate_abnormal_value(
                    self.base_sp, self.sp_variation_abnormal, state['counter'] + i, state['phase'] + 0.5
                )
                op_value = self._generate_abnormal_value(
                    self.base_op, self.op_variation_abnormal, state['counter'] + i, state['phase'] + 1.0
                )
            else:
                # NORMAL: Stable values
                pv_value = self._generate_normal_value(self.base_pv, self.pv_variation_normal)
                sp_value = self._generate_normal_value(self.base_sp, self.sp_variation_normal)
                op_value = self._generate_normal_value(self.base_op, self.op_variation_normal)
            
            # Add some realistic control behavior
            if abs(pv_value - sp_value) > 1.0:
                # Adjust output based on error (proportional control)
                error = sp_value - pv_value
                op_value += error * 0.2
            
            mode = "AUT"  # Keep mode consistent during trend
            
            loop_data = [
                {
                    "_time": timestamp,
                    "loop_id": loop_id,
                    "_field": "PV",
                    "_value": round(pv_value, 7),
                    "Mode": mode,
                    "_measurement": "control_loops"
                },
                {
                    "_time": timestamp,
                    "loop_id": loop_id,
                    "_field": "OP",
                    "_value": round(op_value, 7),
                    "Mode": mode,
                    "_measurement": "control_loops"
                },
                {
                    "_time": timestamp,
                    "loop_id": loop_id,
                    "_field": "SP",
                    "_value": round(sp_value, 7),
                    "Mode": mode,
                    "_measurement": "control_loops"
                }
            ]
            
            all_data.extend(loop_data)
        
        return all_data
    
    def _generate_normal_value(self, base_value: float, variation: float) -> float:
        """
        Generate a normal, stable value with small variations.
        
        Args:
            base_value: Base value to vary around
            variation: Small variation range
            
        Returns:
            Stable value with minimal noise
        """
        # Small random variation
        random_variation = random.uniform(-variation, variation)
        
        # Small Gaussian noise for realism
        noise = random.gauss(0, self.noise_std_normal)
        
        return round(base_value + random_variation + noise, 7)
    
    def _generate_abnormal_value(self, base_value: float, variation: float, 
                                 counter: int, phase: float) -> float:
        """
        Generate abnormal value with large fluctuations, oscillations, and disturbances.
        
        Args:
            base_value: Base value to vary around
            variation: Large variation range
            counter: Time counter for creating patterns
            phase: Phase offset for different patterns
            
        Returns:
            Abnormal value with large fluctuations
        """
        # Fast oscillation (high frequency, large amplitude)
        fast_osc = self.oscillation_amplitude_abnormal * np.sin(
            2 * np.pi * self.oscillation_frequency_abnormal * counter + phase
        )
        
        # Medium oscillation (medium frequency)
        medium_osc = (self.oscillation_amplitude_abnormal * 0.6) * np.sin(
            2 * np.pi * self.oscillation_frequency_abnormal * 0.4 * counter + phase * 1.5
        )
        
        # Slow trend (creates long-term ups and downs)
        slow_trend = variation * 0.5 * np.sin(
            2 * np.pi * 0.005 * counter + phase * 2
        )
        
        # Random walk component for unpredictability
        random_walk = random.uniform(-variation * 0.4, variation * 0.4)
        
        # Larger Gaussian noise
        noise = random.gauss(0, self.noise_std_abnormal)
        
        # Combine all components
        total_variation = fast_osc + medium_osc + slow_trend + random_walk + noise
        
        # Add frequent spikes during abnormal mode (20% chance)
        if random.random() < 0.2:
            spike = random.choice([-1, 1]) * variation * random.uniform(0.8, 1.5)
            total_variation += spike
        
        return round(base_value + total_variation, 7)
    
    def add_custom_loop(self, loop_id: str, base_pv: float, base_sp: float, base_op: float):
        """
        Add a custom loop with specific base values.
        
        Args:
            loop_id: Loop identifier
            base_pv: Base PV value
            base_sp: Base SP value  
            base_op: Base OP value
        """
        if loop_id not in self.loop_ids:
            self.loop_ids.append(loop_id)
        
        # Store custom values (could extend this to store per-loop parameters)
        logger.info(f"Added custom loop {loop_id} with PV={base_pv}, SP={base_sp}, OP={base_op}")
    
    def get_available_loops(self) -> List[str]:
        """Get list of available loop IDs."""
        return self.loop_ids.copy()
