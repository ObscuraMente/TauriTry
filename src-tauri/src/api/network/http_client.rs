use serde::de::DeserializeOwned;
use std::collections::HashMap;

#[derive(Debug)]
#[allow(dead_code)]
pub enum ApiError {
    NetworkError(reqwest::Error),
    InvalidResponse(String),
    Timeout,
    // 其他错误类型...
}

impl From<reqwest::Error> for ApiError {
    fn from(err: reqwest::Error) -> Self {
        ApiError::NetworkError(err)
    }
}

pub async fn get<T: DeserializeOwned>(url: &str) -> Result<T, ApiError> {
    println!("发送GET请求到: {}", url);
    let start = std::time::Instant::now();

    let client = reqwest::Client::new();
    let response = client.get(url).send().await?;

    let status = response.status();
    println!("收到响应，状态码: {}, 耗时: {:?}", status, start.elapsed());

    // 获取响应文本
    let text = response.text().await?;
    println!("原始响应内容: {}", text);

    // 然后手动解析
    match serde_json::from_str::<T>(&text) {
        Ok(data) => {
            println!("成功解析响应数据");
            Ok(data)
        }
        Err(e) => {
            println!("解析响应失败: {:?}", e);
            Err(ApiError::InvalidResponse(e.to_string()))
        }
    }
}

pub async fn _post<T: DeserializeOwned, B: serde::Serialize>(
    url: &str,
    body: &B,
) -> Result<T, ApiError> {
    let client = reqwest::Client::new();
    let response = client.post(url).json(body).send().await?;
    let data = response.json::<T>().await?;
    Ok(data)
}

pub async fn _get_with_headers<T: DeserializeOwned>(
    url: &str,
    headers: HashMap<&str, &str>,
) -> Result<T, ApiError> {
    let client = reqwest::Client::new();
    let mut request_builder = client.get(url);

    for (key, value) in headers {
        request_builder = request_builder.header(key, value);
    }

    let response = request_builder.send().await?;
    let data = response.json::<T>().await?;
    Ok(data)
}
