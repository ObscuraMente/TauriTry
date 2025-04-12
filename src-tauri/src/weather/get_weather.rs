use crate::network::http_client;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::env;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::command;

// 缓存结构
static WEATHER_CACHE: Lazy<Mutex<Option<(WeatherData, Instant)>>> = Lazy::new(|| Mutex::new(None));
const CACHE_DURATION: Duration = Duration::from_secs(30 * 60); // 30分钟缓存

#[derive(Debug, Serialize, Deserialize)]
pub struct WeatherIpResponse {
    status: String,
    info: String,
    infocode: String,
    province: Option<String>,
    city: Option<String>,
    adcode: Option<String>,
    rectangle: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WeatherResponse {
    status: String,
    info: String,
    infocode: String,
    count: String,
    lives: Vec<WeatherLive>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WeatherLive {
    province: String,
    city: String,
    adcode: String,
    weather: String,
    temperature: String,
    winddirection: String,
    windpower: String,
    humidity: String,
    reporttime: String,
    temperature_float: String,
    humidity_float: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WeatherData {
    province: String,
    city: String,
    weather: String,
    temperature: String,
    humidity: String,
    update_time: String,
}

#[command]
pub async fn get_weather() -> Result<WeatherData, String> {
    // 检查缓存
    {
        let cache = WEATHER_CACHE.lock().unwrap();
        if let Some((data, time)) = &*cache {
            if time.elapsed() < CACHE_DURATION {
                println!("返回缓存的天气数据");
                return Ok(data.clone());
            }
        }
    }

    println!("正在获取天气数据...");
    // 从环境变量或配置获取API密钥
    let key =
        env::var("AMAP_API_KEY").unwrap_or_else(|_| "0a6aa5058bc030028221b8d5cbb94125".to_string());

    // 获取IP位置信息
    let ip_info = http_client::get::<WeatherIpResponse>(&format!(
        "https://restapi.amap.com/v3/ip?key={}",
        key
    ))
    .await
    .map_err(|e| format!("IP定位失败: {:?}", e))?;

    // 验证返回状态码
    if ip_info.status != "1" {
        return Err(format!("IP定位API返回错误: {}", ip_info.info));
    }

    // 安全地获取adcode，处理可能的None值
    let adcode = ip_info
        .adcode
        .as_ref()
        .ok_or_else(|| "未找到地区编码".to_string())?;

    // 获取天气数据
    let weather_url = format!(
        "https://restapi.amap.com/v3/weather/weatherInfo?city={}&key={}",
        adcode, key
    );

    let weather_response = http_client::get::<WeatherResponse>(&weather_url)
        .await
        .map_err(|e| format!("获取天气数据失败: {:?}", e))?;

    // 验证返回状态码
    if weather_response.status != "1" {
        return Err(format!("天气API返回错误: {}", weather_response.info));
    }

    // 确保lives数组不为空
    if weather_response.lives.is_empty() {
        return Err("未找到天气数据".to_string());
    }

    let live_data = &weather_response.lives[0];

    // 构建返回数据结构
    let weather_data = WeatherData {
        province: live_data.province.clone(),
        city: live_data.city.clone(),
        weather: live_data.weather.clone(),
        temperature: live_data.temperature.clone(),
        humidity: live_data.humidity.clone(),
        update_time: live_data.reporttime.clone(),
    };

    // 更新缓存
    {
        let mut cache = WEATHER_CACHE.lock().unwrap();
        *cache = Some((weather_data.clone(), Instant::now()));
    }

    println!(
        "获取天气数据成功: {}市 {}℃",
        weather_data.city, weather_data.temperature
    );
    Ok(weather_data)
}

// 前端可以直接获取格式化的天气字符串
#[command]
pub async fn get_weather_text() -> String {
    match get_weather().await {
        Ok(data) => format!(
            "{}  {}  {}  {}℃",
            data.province, data.city, data.weather, data.temperature
        ),
        Err(e) => format!("天气获取失败: {}", e),
    }
}
